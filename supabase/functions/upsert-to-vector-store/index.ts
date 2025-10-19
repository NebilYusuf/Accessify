import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { notebook_id, source_id, content } = await req.json()

    if (!notebook_id || !source_id || !content) {
      return new Response(
        JSON.stringify({ error: 'notebook_id, source_id, and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Upserting to vector store:', { notebook_id, source_id, content_length: content.length })

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get OpenAI API key for embeddings
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Split content into chunks (simple chunking, 1000 chars with 200 overlap)
    const chunkSize = 1000
    const chunkOverlap = 200
    const chunks: string[] = []
    
    for (let i = 0; i < content.length; i += (chunkSize - chunkOverlap)) {
      const chunk = content.slice(i, i + chunkSize)
      if (chunk.trim().length > 0) {
        chunks.push(chunk)
      }
    }

    console.log(`Split content into ${chunks.length} chunks`)

    // Process chunks in batches to avoid rate limits
    const batchSize = 10
    let totalInserted = 0

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`)

      // Generate embeddings for this batch
      const embeddingPromises = batch.map(async (chunk, idx) => {
        try {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-ada-002',
              input: chunk
            })
          })

          if (!embeddingResponse.ok) {
            const errorText = await embeddingResponse.text()
            console.error(`Failed to generate embedding for chunk ${i + idx}:`, errorText)
            return null
          }

          const embeddingData = await embeddingResponse.json()
          const embedding = embeddingData.data[0].embedding

          // Insert into vector store
          const { error: insertError } = await supabaseClient
            .from('documents')
            .insert({
              content: chunk,
              metadata: {
                notebook_id,
                source_id,
                chunk_index: i + idx,
                chunk_lines_from: 1 + (i + idx) * 10, // Approximate line numbers
                chunk_lines_to: 10 + (i + idx) * 10
              },
              embedding: JSON.stringify(embedding)
            })

          if (insertError) {
            console.error(`Failed to insert chunk ${i + idx}:`, insertError)
            return null
          }

          return true
        } catch (error) {
          console.error(`Error processing chunk ${i + idx}:`, error)
          return null
        }
      })

      const results = await Promise.all(embeddingPromises)
      const successCount = results.filter(r => r !== null).length
      totalInserted += successCount
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`Successfully inserted ${totalInserted}/${chunks.length} chunks to vector store`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully inserted ${totalInserted} chunks`,
        total_chunks: chunks.length,
        notebook_id,
        source_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in upsert-to-vector-store function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


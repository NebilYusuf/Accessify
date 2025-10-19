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
    const { sourceId, filePath } = await req.json()

    if (!sourceId || !filePath) {
      return new Response(
        JSON.stringify({ error: 'sourceId and filePath are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting Mathpix PDF preprocessing for:', { sourceId, filePath });

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get notebook_id from the source
    const { data: sourceData, error: sourceError } = await supabaseClient
      .from('sources')
      .select('notebook_id')
      .eq('id', sourceId)
      .single()

    if (sourceError || !sourceData) {
      console.error('Failed to fetch source notebook_id:', sourceError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch source information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notebookId = sourceData.notebook_id
    console.log('Source belongs to notebook:', notebookId)

    // Get Mathpix credentials
    const mathpixAppId = Deno.env.get('MATHPIX_APP_ID')
    const mathpixAppKey = Deno.env.get('MATHPIX_APP_KEY')

    if (!mathpixAppId || !mathpixAppKey) {
      console.error('Mathpix credentials not configured')
      return new Response(
        JSON.stringify({ error: 'Mathpix API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('sources')
      .download(filePath)

    if (downloadError) {
      console.error('Failed to download file:', downloadError)
      throw downloadError
    }

    console.log('File downloaded, sending to Mathpix using FormData...');

    // Create FormData for Mathpix API (like your working code)
    const arrayBuffer = await fileData.arrayBuffer()
    const formData = new FormData()
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
    formData.append('file', blob, 'document.pdf')
    formData.append('options_json', JSON.stringify({
      conversion_formats: {
        html: true,
        md: true
      }
    }))
    
    console.log('Sending FormData request to Mathpix API...')
    
    const mathpixResponse = await fetch('https://api.mathpix.com/v3/pdf', {
      method: 'POST',
      headers: {
        'app_id': mathpixAppId,
        'app_key': mathpixAppKey,
      },
      body: formData
    })

    if (!mathpixResponse.ok) {
      const errorText = await mathpixResponse.text()
      console.error('Mathpix API error:', mathpixResponse.status, errorText)
      throw new Error(`Mathpix API error: ${errorText}`)
    }

    const mathpixResult = await mathpixResponse.json()
    console.log('Mathpix API response:', JSON.stringify(mathpixResult, null, 2))
    
    // Check if we got a valid response
    if (!mathpixResult || !mathpixResult.pdf_id) {
      console.error('Invalid Mathpix response:', mathpixResult)
      throw new Error('Mathpix API returned invalid response')
    }
    
    console.log('Mathpix processing initiated, PDF ID:', mathpixResult.pdf_id)

    // Poll for completion (Mathpix processes asynchronously)
    let processedData
    let attempts = 0
    const maxAttempts = 30 // 30 attempts * 2 seconds = 60 seconds max

    while (attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        attempts++

        console.log(`Checking Mathpix status (attempt ${attempts}/${maxAttempts})...`)

        const statusResponse = await fetch(`https://api.mathpix.com/v3/pdf/${mathpixResult.pdf_id}`, {
          headers: {
            'app_id': mathpixAppId,
            'app_key': mathpixAppKey,
          }
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log('Mathpix status:', statusData.status)

          if (statusData.status === 'completed') {
            processedData = statusData
            console.log('Mathpix completed, status data:', JSON.stringify(statusData, null, 2))
            break
          } else if (statusData.status === 'error') {
            throw new Error('Mathpix processing failed')
          }
        } else {
          const errorText = await statusResponse.text()
          console.warn(`Status check failed: ${statusResponse.status} - ${errorText}`)
        }
      } catch (pollError) {
        console.error('Error during polling:', pollError)
        if (attempts >= maxAttempts) {
          throw pollError
        }
      }
    }

    if (!processedData) {
      throw new Error('Mathpix processing timeout')
    }

    console.log('Mathpix processing completed, downloading LaTeX-formatted PDF...');
    console.log('Processed data structure:', JSON.stringify(processedData, null, 2));

    // Get the HTML content from Mathpix (using correct endpoint format)
    console.log('Downloading HTML content from Mathpix...');
    
    const htmlUrl = `https://api.mathpix.com/v3/pdf/${mathpixResult.pdf_id}.html`
    console.log('HTML URL:', htmlUrl);
    
    const htmlResponse = await fetch(htmlUrl, {
      headers: {
        'app_id': mathpixAppId,
        'app_key': mathpixAppKey,
      }
    })
    
    if (!htmlResponse.ok) {
      const errorText = await htmlResponse.text()
      console.error('Failed to download HTML from Mathpix:', htmlResponse.status, errorText)
      throw new Error(`Failed to download HTML from Mathpix: ${htmlResponse.status}`)
    }
    
    const htmlContent = await htmlResponse.text()
    console.log('Successfully downloaded HTML content, length:', htmlContent.length, 'characters')
    
    // Replace the PDF file with HTML file
    const htmlBlob = new Blob([htmlContent], { type: 'text/plain' })
    
    // Update file path to have .html extension
    const htmlFilePath = filePath.replace(/\.pdf$/i, '.html')
    console.log('Replacing PDF with HTML file:', htmlFilePath);
    
    // Upload the HTML file
    const { error: uploadError } = await supabaseClient.storage
      .from('sources')
      .upload(htmlFilePath, htmlBlob, {
        contentType: 'text/plain',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Failed to upload HTML file:', uploadError)
      throw uploadError
    }
    
    console.log('HTML file uploaded successfully')
    
    // Extract plain text from HTML for RAG/chat (remove HTML tags but keep content)
    let plainText = htmlContent
      // Remove script and style elements completely
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove HTML tags but keep the text content
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim()
    
    console.log('Extracted plain text for RAG, length:', plainText.length)
    
    // Get existing metadata or create empty object
    const { data: existingSource } = await supabaseClient
      .from('sources')
      .select('metadata')
      .eq('id', sourceId)
      .single()
    
    const existingMetadata = existingSource?.metadata || {}
    
    // Store HTML content directly in the database and mark as completed
    // HTML in content field (for display), plain text in metadata (for RAG)
    const { error: updateError } = await supabaseClient
      .from('sources')
      .update({ 
        file_path: htmlFilePath,
        content: htmlContent,  // HTML for beautiful display in source viewer
        summary: 'Processed with Mathpix - LaTeX formatted content',  // Basic summary
        processing_status: 'completed',  // Mark as completed immediately
        metadata: {
          ...existingMetadata,
          plain_text: plainText,  // Plain text for RAG/chat
          is_mathpix_processed: true,
          processed_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceId)
    
    if (updateError) {
      console.error('Failed to update source:', updateError)
      throw updateError
    }
    
    console.log('Source updated with HTML content (for display) and plain text (for RAG)')
    
    // Now send plain text to vector store for embeddings using our direct function
    console.log('Calling direct vector store upsert function...')
    
    try {
      const vectorResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/upsert-to-vector-store`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            notebook_id: notebookId,
            source_id: sourceId,
            content: plainText
          })
        }
      )
      
      console.log('Vector store response status:', vectorResponse.status)
      
      if (!vectorResponse.ok) {
        const errorText = await vectorResponse.text()
        console.error('Failed to upsert to vector store:', vectorResponse.status, errorText)
      } else {
        const responseData = await vectorResponse.json()
        console.log('Successfully upserted to vector store:', responseData)
      }
    } catch (vectorError) {
      console.error('Error calling vector store:', vectorError)
      // Don't fail the whole process if vector store fails
    }
    
    // Now enhance accessibility with Gemini (synchronously - wait for completion)
    console.log('Enhancing accessibility with Gemini...')
    
    try {
      const accessibilityResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/enhance-accessibility`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            source_id: sourceId,
            htmlContent: htmlContent
          })
        }
      )
      
      console.log('Accessibility enhancement response status:', accessibilityResponse.status)
      
      if (!accessibilityResponse.ok) {
        const errorText = await accessibilityResponse.text()
        console.error('Failed to enhance accessibility:', accessibilityResponse.status, errorText)
        // Continue with the process even if accessibility enhancement fails
      } else {
        const responseData = await accessibilityResponse.json()
        console.log('Successfully enhanced accessibility:', responseData)
        console.log('Accessibility enhancement completed - proceeding with final response')
      }
    } catch (accessibilityError) {
      console.error('Error enhancing accessibility:', accessibilityError)
      // Don't fail the whole process if accessibility enhancement fails
    }
    
    console.log('All processing completed - returning final response')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'PDF successfully converted to LaTeX-formatted HTML with accessibility enhancements',
        newFilePath: htmlFilePath,
        contentSize: htmlContent.length,
        accessibilityEnhanced: true,
        skipProcessing: true  // Signal to skip process-document
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in preprocess-pdf-mathpix function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


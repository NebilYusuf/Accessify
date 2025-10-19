import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Using Google Generative AI SDK instead of REST API

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { source_id, htmlContent } = await req.json()

    if (!source_id || !htmlContent) {
      return new Response(
        JSON.stringify({ error: 'source_id and htmlContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sourceId = source_id // Use consistent naming

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting accessibility enhancement with Gemini...')

    // Parse HTML to find images and figures
    const images = extractImagesFromHTML(htmlContent)
    console.log(`Found ${images.length} images to enhance`)

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No images found to enhance',
          enhancedHTML: htmlContent,
          accessibilityScore: 100,
          improvements: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Gemini AI once outside the loop
    console.log('Initializing Gemini AI...')
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.2.1')
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    console.log('Gemini AI initialized successfully')

    // Process all images and generate descriptions first
    const imageEnhancements: Array<{image: ImageInfo, altText: string, figureDescription?: string}> = []
    const improvements: string[] = []
    let accessibilityScore = 60 // Start with base score

    console.log(`Starting sequential processing of ${images.length} images...`)

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      console.log(`=== Processing image ${i + 1}/${images.length} ===`)

      try {
        // Generate alt text using Gemini
        const altText = await generateAltTextWithGeminiModel(model, image.src, image.context)
        console.log(`✓ Generated alt text for image ${i + 1}`)
        
        // Generate figure description if it's a figure
        let figureDescription = null
        if (image.isFigure) {
          figureDescription = await generateFigureDescriptionWithGeminiModel(model, image.src, image.context)
          console.log(`✓ Generated figure description for image ${i + 1}`)
        }

        // Store the enhancement data
        imageEnhancements.push({ image, altText, figureDescription })
        
        improvements.push(`Added alt text for image ${i + 1}`)
        if (figureDescription) {
          improvements.push(`Added figure description for image ${i + 1}`)
        }
        
        accessibilityScore += 10 // Increase score for each enhanced image
        
        console.log(`✓ Successfully processed image ${i + 1}/${images.length}`)
      } catch (error) {
        console.error(`✗ Failed to process image ${i + 1}:`, error)
        // Continue with other images even if one fails
      }
    }

    // Now apply all enhancements to the HTML at once
    console.log('Applying all enhancements to HTML...')
    let enhancedHTML = htmlContent

    // Process enhancements in reverse order to avoid index shifting issues
    for (let i = imageEnhancements.length - 1; i >= 0; i--) {
      const { image, altText, figureDescription } = imageEnhancements[i]
      enhancedHTML = enhanceImageAccessibility(enhancedHTML, image, altText, figureDescription)
    }

    console.log(`Completed enhancing all ${images.length} images`)

    // Cap the accessibility score at 100
    accessibilityScore = Math.min(accessibilityScore, 100)

    // Update the source in the database with enhanced content
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get existing metadata
    const { data: existingSource } = await supabaseClient
      .from('sources')
      .select('metadata')
      .eq('id', sourceId)
      .single()

    const existingMetadata = existingSource?.metadata || {}

    // Update source with enhanced HTML and accessibility metadata
    const { error: updateError } = await supabaseClient
      .from('sources')
      .update({
        content: enhancedHTML,
        metadata: {
          ...existingMetadata,
          accessibility_enhanced: true,
          accessibility_score: accessibilityScore,
          accessibility_improvements: improvements,
          enhanced_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceId)

    if (updateError) {
      console.error('Failed to update source with enhanced content:', updateError)
      throw updateError
    }

    console.log('Accessibility enhancement completed successfully')
    console.log(`Final accessibility score: ${accessibilityScore}`)
    console.log(`Total improvements: ${improvements.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Accessibility enhancement completed',
        enhancedHTML,
        accessibilityScore,
        improvements,
        imagesEnhanced: images.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in enhance-accessibility function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

interface ImageInfo {
  src: string
  alt: string
  context: string
  isFigure: boolean
  fullTag: string
  index: number
}

function extractImagesFromHTML(html: string): ImageInfo[] {
  const images: ImageInfo[] = []
  
  // Regex to find img tags
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
  
  let match
  let index = 0

  // Find all img tags
  while ((match = imgRegex.exec(html)) !== null) {
    const fullTag = match[0]
    const src = match[1]
    
    // Extract alt text if present
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i)
    const alt = altMatch ? altMatch[1] : ''
    
    // Get better context (surrounding text with more meaningful content)
    const contextStart = Math.max(0, match.index - 300)
    const contextEnd = Math.min(html.length, match.index + fullTag.length + 300)
    let context = html.substring(contextStart, contextEnd)
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // If context is too short or generic, provide a better default
    if (context.length < 50 || context.toLowerCase().includes('img') || context.toLowerCase().includes('src=')) {
      context = 'Mathematical equation or scientific diagram in STEM document'
    }
    
    // Check if it's inside a figure or has mathematical content
    const isFigure = html.substring(0, match.index).includes('<figure') && 
                     html.substring(match.index).includes('</figure>') ||
                     src.includes('math') || src.includes('equation') || alt.includes('math')
    
    images.push({
      src,
      alt,
      context: context.substring(0, 500), // Limit context length
      isFigure,
      fullTag,
      index: index++
    })
  }

  return images
}

async function generateAltTextWithGeminiModel(model: any, imageSrc: string, context: string): Promise<string> {
  const prompt = `Generate a brief, WCAG-compliant alt text for this STEM document image.

Context: ${context.substring(0, 200) || 'Scientific/technical document'}

Requirements:
- Maximum 1-2 sentences
- Focus on key visual elements
- Use simple, clear language
- Suitable for screen readers
- Keep under 150 characters

Provide only the alt text.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const description = response.text()
    
    // Truncate if too long
    const trimmed = description.trim()
    return trimmed.length > 150 ? trimmed.substring(0, 147) + '...' : trimmed
  } catch (error) {
    console.error('Error generating image description:', error.message)
    return `Mathematical equation or diagram`
  }
}

async function generateFigureDescriptionWithGeminiModel(model: any, imageSrc: string, context: string): Promise<string> {
  const prompt = `Generate a concise description for this STEM figure.

Context: ${context.substring(0, 200) || 'Mathematical content'}

Requirements:
- 2-3 sentences maximum
- Describe the figure type (equation, diagram, chart)
- Include key mathematical concepts or data
- Use clear, accessible language
- Keep under 200 characters

Provide only the description.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const description = response.text()
    
    // Truncate if too long
    const trimmed = description.trim()
    return trimmed.length > 200 ? trimmed.substring(0, 197) + '...' : trimmed
  } catch (error) {
    console.error('Error generating figure description:', error.message)
    return `Mathematical equation or diagram`
  }
}

function enhanceImageAccessibility(html: string, image: ImageInfo, altText: string, figureDescription?: string): string {
  let enhancedHTML = html

  // Replace the img tag with enhanced version
  let finalImgTag = image.fullTag
  
  // Update or add alt attribute
  if (finalImgTag.includes('alt=')) {
    finalImgTag = finalImgTag.replace(/alt=["'][^"']*["']/i, `alt="${altText}"`)
  } else {
    finalImgTag = finalImgTag.replace('>', ` alt="${altText}">`)
  }

  // Replace the original img tag with the enhanced version
  enhancedHTML = enhancedHTML.replace(image.fullTag, finalImgTag)

  // If it's a figure and we have a description, add a figcaption right after the img tag
  if (image.isFigure && figureDescription) {
    const figcaptionHtml = `<figcaption class="accessibility-description" style="font-style: italic; color: #666; margin-top: 8px;" aria-label="Figure description">${figureDescription}</figcaption>`
    
    // Find the position of the enhanced img tag and add figcaption right after it
    const imgTagIndex = enhancedHTML.indexOf(finalImgTag)
    if (imgTagIndex !== -1) {
      const insertPosition = imgTagIndex + finalImgTag.length
      enhancedHTML = enhancedHTML.substring(0, insertPosition) + 
                    figcaptionHtml + 
                    enhancedHTML.substring(insertPosition)
    }
  } else if (figureDescription) {
    // If it's not a figure but we have a description, add a description div after the img
    const descriptionHtml = `<div class="accessibility-description" style="font-style: italic; color: #666; margin-top: 8px; padding: 8px; background: #f8f9fa; border-left: 3px solid #007bff;" aria-label="Image description">${figureDescription}</div>`
    
    const imgTagIndex = enhancedHTML.indexOf(finalImgTag)
    if (imgTagIndex !== -1) {
      const insertPosition = imgTagIndex + finalImgTag.length
      enhancedHTML = enhancedHTML.substring(0, insertPosition) + 
                    descriptionHtml + 
                    enhancedHTML.substring(insertPosition)
    }
  }

  return enhancedHTML
}

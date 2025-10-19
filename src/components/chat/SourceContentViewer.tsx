
import React, { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Citation } from '@/types/message';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface SourceContentViewerProps {
  citation: Citation | null;
  sourceContent?: string;
  sourceSummary?: string;
  sourceUrl?: string;
  className?: string;
  isOpenedFromSourceList?: boolean;
}

const SourceContentViewer = ({ 
  citation, 
  sourceContent, 
  sourceSummary,
  sourceUrl,
  className = '',
  isOpenedFromSourceList = false
}: SourceContentViewerProps) => {
  const highlightedContentRef = useRef<HTMLDivElement>(null);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
  
  // Control accordion state based on how the viewer was opened
  const [accordionValue, setAccordionValue] = useState<string>(
    isOpenedFromSourceList ? "guide" : ""
  );

  // Check if we have valid citation line data (indicating a real citation click)
  const hasValidCitationLines = citation && 
    typeof citation.chunk_lines_from === 'number' && 
    typeof citation.chunk_lines_to === 'number' &&
    citation.chunk_lines_from > 0;

  console.log('SourceContentViewer: Render with citation', {
    citationId: citation?.citation_id,
    sourceId: citation?.source_id,
    hasValidCitationLines,
    isOpenedFromSourceList,
    chunkLinesFrom: citation?.chunk_lines_from,
    chunkLinesTo: citation?.chunk_lines_to
  });

  // Auto-scroll to highlighted content when citation changes and has valid line data
  useEffect(() => {
    console.log('SourceContentViewer: Auto-scroll effect triggered', {
      hasValidCitationLines,
      citationId: citation?.citation_id,
      hasHighlightedRef: !!highlightedContentRef.current,
      hasScrollAreaRef: !!scrollAreaViewportRef.current
    });

    if (hasValidCitationLines && highlightedContentRef.current && scrollAreaViewportRef.current) {
      console.log('SourceContentViewer: Starting auto-scroll process');
      
      // Increased delay to ensure DOM has fully updated
      const timer = setTimeout(() => {
        if (highlightedContentRef.current && scrollAreaViewportRef.current) {
          console.log('SourceContentViewer: Executing auto-scroll');
          
          // Find the actual viewport element within the ScrollArea
          const scrollAreaElement = scrollAreaViewportRef.current;
          const viewport = scrollAreaElement.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          
          if (viewport && highlightedContentRef.current) {
            const highlightedElement = highlightedContentRef.current;
            
            console.log('SourceContentViewer: Scroll calculation', {
              highlightedOffsetTop: highlightedElement.offsetTop,
              highlightedHeight: highlightedElement.clientHeight,
              viewportHeight: viewport.clientHeight,
              currentScrollTop: viewport.scrollTop
            });
            
            // Calculate the scroll position to center the highlighted content
            const scrollTop = highlightedElement.offsetTop - (viewport.clientHeight / 2) + (highlightedElement.clientHeight / 2);
            const targetScrollTop = Math.max(0, scrollTop);
            
            console.log('SourceContentViewer: Scrolling to position', { targetScrollTop });
            
            viewport.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            });
          } else {
            console.log('SourceContentViewer: Viewport or highlighted element not found', {
              viewport: !!viewport,
              highlightedElement: !!highlightedContentRef.current
            });
          }
        }
      }, 300); // Increased delay for better reliability

      return () => clearTimeout(timer);
    }
  }, [citation?.citation_id, citation?.chunk_lines_from, citation?.chunk_lines_to, citation?.source_id, hasValidCitationLines]);

  // Close guide when a real citation is clicked (has valid line data)
  useEffect(() => {
    if (hasValidCitationLines) {
      console.log('SourceContentViewer: Closing guide for real citation');
      setAccordionValue("");
    }
  }, [hasValidCitationLines]);

  if (!citation || !sourceContent) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">Select a citation to view source content</p>
      </div>
    );
  }

  const getSourceIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'pdf': '/file-types/PDF.svg',
      'text': '/file-types/TXT.png',
      'website': '/file-types/WEB.svg',
      'youtube': '/file-types/MP3.png',
      'audio': '/file-types/MP3.png',
      'doc': '/file-types/DOC.png',
      'multiple-websites': '/file-types/WEB.svg',
      'copied-text': '/file-types/TXT.png'
    };

    const iconUrl = iconMap[type] || iconMap['text']; // fallback to TXT icon
    
    return (
      <img 
        src={iconUrl} 
        alt={`${type} icon`} 
        className="w-full h-full object-contain"
        onError={(e) => {
          // Fallback to a simple text indicator if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          target.parentElement!.innerHTML = '📄';
        }}
      />
    );
  };

  // Check if content is HTML (starts with <!DOCTYPE html> or <html>)
  const isHtmlContent = sourceContent.trim().startsWith('<!DOCTYPE') || sourceContent.trim().startsWith('<html');
  
  // Split content into lines for highlighting (only for non-HTML content)
  const lines = !isHtmlContent ? sourceContent.split('\n') : [];
  
  // Determine the highlight range based on whether we have valid citation line data
  let startLine: number;
  let endLine: number;
  
  if (hasValidCitationLines) {
    // For real citations with valid line data, highlight the specific lines
    startLine = citation.chunk_lines_from!;
    endLine = citation.chunk_lines_to!;
    console.log('SourceContentViewer: Will highlight lines', { startLine, endLine });
  } else {
    // For source list clicks or citations without line data, don't highlight
    startLine = -1;
    endLine = -1;
    console.log('SourceContentViewer: No highlighting (no valid line data)');
  }

  const renderHtmlContent = () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    return (
      <div className="w-full h-full">
        <iframe
          ref={iframeRef}
          srcDoc={sourceContent}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts"
          title="Source Content"
          onLoad={() => {
            const iframe = iframeRef.current;
            if (!iframe) return;
    
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;

            const script = doc.createElement('script');
            script.textContent = `
              (function(){


  // Function to handle text selection anywhere in the window
  const textSelected = () => {
    let rect = window.getSelection().getRangeAt(0).getBoundingClientRect()

    async function speakTextWithElevenLabs(text) {
      const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Example: Rachel's voice ID. Choose your preferred default.
  
      const ELEVENLABS_API_KEY = '${import.meta.env.VITE_ELEVENLABS_API_KEY}';
      if (!ELEVENLABS_API_KEY) {
          console.error("ElevenLabs API key is not set. Please replace 'YOUR_ELEVENLABS_API_KEY'.");
          return;
      }
  
      try {
          const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + DEFAULT_VOICE_ID, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'xi-api-key': ELEVENLABS_API_KEY,
              },
              body: JSON.stringify({
                  text: text,
                  model_id: 'eleven_multilingual_v2', // Or another preferred model
                  voice_settings: {
                      stability: 0.75,
                      similarity_boost: 0.75
                  }
              })
          });
  
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error("ElevenLabs API error: " + response.status + " - " + errorData.detail);
          }
  
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();
  
      } catch (error) {
          console.error('Error generating or playing audio:', error);
      }
    }
  
  // Example usage:
  // speakTextWithElevenLabs("Hello, this is a test of the ElevenLabs text-to-speech integration.");

    function addFloatingSpeakTextButton(x, y) {
      const floatingButton = document.createElement('button');
      floatingButton.textContent = 'Speak text using ElevenLabs';
      floatingButton.id = 'myFloatingButton'; // Optional: for easier selection later
  
      floatingButton.style.position = 'fixed';
      floatingButton.style.left = x + "px";
      floatingButton.style.top = y + "px";
      floatingButton.style.zIndex = '9999'; // Ensure it's on top
      floatingButton.style.backgroundColor = 'black'; // Example styling
      floatingButton.style.color = 'white';
      floatingButton.style.padding = '10px 20px';
      floatingButton.style.border = 'none';
      floatingButton.style.borderRadius = '8px';
      floatingButton.style.cursor = 'pointer';
  
      // Optional: Add an event listener
      floatingButton.addEventListener('click', () => {
        speakTextWithElevenLabs(window.getSelection().toString());
      });

      (window).floatingSpeakTextButton = floatingButton;
      document.body.appendChild(floatingButton);
    }
  
    // Call the function to add a button at (50, 100)

    const buttonHeight = 50;
    const buttonWidth = 200;

    addFloatingSpeakTextButton(rect.x + ((rect.width - buttonWidth) / 2), rect.y - buttonHeight);

    console.log('Text selected');
    // Empty function as requested - can be extended later
  };
              
const handleTextSelection = () => {
  if ((window).floatingSpeakTextButton) {
    let currentButton = (window).floatingSpeakTextButton;
    setTimeout(() => {
      currentButton.remove();
    }, 100);
  }
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    textSelected();
  }
};

// Add event listeners for text selection
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', handleTextSelection);
              })();
            `;
            doc.head.appendChild(script);
          }}
        />
      </div>
    );
  };

  const renderHighlightedContent = () => {
    return lines.map((line, index) => {
      const lineNumber = index + 1;
      const isHighlighted = startLine > 0 && lineNumber >= startLine && lineNumber <= endLine;
      const isFirstHighlightedLine = isHighlighted && lineNumber === startLine;
      
      return (
        <div
          key={index}
          ref={isFirstHighlightedLine ? highlightedContentRef : null}
          className={`py-2 px-3 rounded leading-relaxed ${
            isHighlighted 
              ? 'border-l-4' 
              : 'hover:bg-gray-50'
          }`}
          style={isHighlighted ? { 
            backgroundColor: '#eadef9', 
            borderLeftColor: '#9333ea' 
          } : {}}
        >
          <span className={isHighlighted ? 'font-medium' : ''}>{line}</span>
        </div>
      );
    });
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-6 h-6 bg-white rounded border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {getSourceIcon(citation.source_type)}
          </div>
          <span className="font-medium text-gray-900 truncate">{citation.source_title}</span>
          {isHtmlContent && (
            <Badge variant="secondary" className="text-xs bg-accent/20 text-accent-foreground">
              LaTeX
            </Badge>
          )}
        </div>
      </div>

      {/* Source Guide Accordion */}
      {sourceSummary && (
        <div className="border-b border-gray-200 flex-shrink-0">
          <Accordion type="single" value={accordionValue} onValueChange={setAccordionValue} collapsible>
            <AccordionItem value="guide" className="border-0">
              <AccordionTrigger 
                className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-primary/5" 
                style={{ color: '#234776' }}
                chevronColor="#234776"
              >
                <div className="flex items-center space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#234776">
                    <path d="M166.67-120.67 120-167.33l317.67-318L254-531l194-121-16.33-228 175 147L818-818.33l-85.67 211.66L880-432l-228.67-16.67-120.66 194L485-438.33 166.67-120.67Zm24.66-536L120-728l72-72 71.33 71.33-72 72Zm366.34 233 58-94.33 111 8.33-72-85 41.66-102.66-102.66 41.66-85-71.66L517-616.67l-94.33 59 108 26.67 27 107.33Zm171 303.67-71.34-72 71.34-71.33 71.33 72L728.67-120ZM575-576Z"/>
                  </svg>
                  <span>Source guide</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="text-sm text-gray-700 space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="leading-relaxed">{sourceSummary}</p>
                  </div>
                  
                  {/* Show URL for website sources */}
                  {citation.source_type === 'website' && sourceUrl && (
                    <div>
                      <h4 className="font-medium mb-2">URL</h4>
                      <a 
                        href={sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 hover:underline break-all text-sm"
                      >
                        {sourceUrl}
                      </a>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Content */}
      {isHtmlContent ? (
        // Render HTML content in iframe
        <div className="flex-1 h-full">
          {renderHtmlContent()}
        </div>
      ) : (
        // Render text content with highlighting
        <ScrollArea className="flex-1 h-full" ref={scrollAreaViewportRef}>
          <div className="p-4">
            <div className="prose prose-gray max-w-none space-y-1">
              {renderHighlightedContent()}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default SourceContentViewer;

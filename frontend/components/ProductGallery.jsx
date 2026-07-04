'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, Play } from 'lucide-react';

const VIDEO_FILE_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

function isDirectVideoFile(url = '') {
  const u = url.toLowerCase().split('?')[0];
  return VIDEO_FILE_EXTENSIONS.some((ext) => u.endsWith(ext));
}

function getYouTubeEmbed(url = '') {
  // Match youtube.com/watch?v=, youtu.be/, youtube.com/embed/
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return null;
}

function getVimeoEmbed(url = '') {
  const vMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vMatch) return `https://player.vimeo.com/video/${vMatch[1]}`;
  return null;
}

function classifyMedia(item) {
  if (!item) return { kind: 'image' };
  const url = item.url || item.file_url || '';
  if (item.media_type === 'VIDEO') {
    if (isDirectVideoFile(url)) return { kind: 'video-file', src: url };
    const yt = getYouTubeEmbed(url);
    if (yt) return { kind: 'embed', src: yt };
    const vimeo = getVimeoEmbed(url);
    if (vimeo) return { kind: 'embed', src: vimeo };
    return { kind: 'embed', src: url };
  }
  return { kind: 'image', src: url };
}

export default function ProductGallery({ images = [], productName = '' }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setIsZoomed(false);
  };

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setIsZoomed(false);
  };

  if (!images || images.length === 0) {
    return (
      <div className="rounded-lg border border-edge bg-surface-muted aspect-square flex items-center justify-center">
        <div className="text-center text-ink-subtle">
          <p>No images available</p>
        </div>
      </div>
    );
  }

  const currentItem = images[selectedIndex];
  const current = classifyMedia(currentItem);
  const isVideo = current.kind !== 'image';

  return (
    <div className="space-y-4">
      {/* Main Media */}
      <div className="relative rounded-lg border border-edge overflow-hidden bg-surface-muted aspect-square group">
        {current.kind === 'image' && (
          <img
            src={current.src}
            alt={currentItem.alt || productName}
            className={`w-full h-full object-cover transition-transform duration-300 cursor-zoom-in ${
              isZoomed ? 'scale-150' : 'scale-100'
            }`}
            onClick={() => setIsZoomed(!isZoomed)}
          />
        )}

        {current.kind === 'video-file' && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              key={current.src}
              src={current.src}
              controls
              preload="metadata"
              className="w-full h-full object-contain"
              style={{ aspectRatio: '16/9' }}
            />
          </div>
        )}

        {current.kind === 'embed' && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <iframe
              key={current.src}
              src={current.src}
              title={`${productName} video`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
              style={{ aspectRatio: '16/9' }}
            />
          </div>
        )}

        {/* Zoom button - images only */}
        {!isVideo && (
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-sm border border-edge bg-surface shadow-card hover:shadow-elevated transition-shadow"
            aria-label="Zoom image"
          >
            <ZoomIn className="h-5 w-5 text-ink-primary" />
          </button>
        )}

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-sm bg-surface/90 hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Previous media"
            >
              <ChevronLeft className="h-5 w-5 text-ink-primary" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-sm bg-surface/90 hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Next media"
            >
              <ChevronRight className="h-5 w-5 text-ink-primary" />
            </button>
          </>
        )}

        {/* Counter */}
        <div className="absolute bottom-4 right-4 rounded-xs bg-surface-inverse/70 px-3 py-1 text-xs font-medium text-white">
          {selectedIndex + 1}/{images.length}
        </div>
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => {
            const meta = classifyMedia(image);
            const thumbSrc = image.thumbnail || image.poster || (meta.kind === 'image' ? meta.src : '');
            const isVid = meta.kind !== 'image';
            return (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                aria-label={`Show ${isVid ? 'video' : 'image'} ${index + 1}`}
                className={`relative h-16 w-16 flex-shrink-0 rounded-sm overflow-hidden border transition-colors ${
                  selectedIndex === index ? 'border-ink-primary' : 'border-edge hover:border-edge-strong'
                }`}
              >
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-inverse flex items-center justify-center">
                    <span className="text-[9px] font-medium tracking-widest text-white">VIDEO</span>
                  </div>
                )}
                {isVid && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-5 w-5 text-white fill-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

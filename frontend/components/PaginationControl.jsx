'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControl({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 12,
  onPageChange = () => {},
  variant = 'load-more', // 'load-more' | 'pagination'
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (variant === 'load-more') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {currentPage < totalPages && (
          <>
            <p className="text-xs text-ink-muted">
              Showing {startItem}–{endItem} of {totalItems} products
            </p>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              className="px-6 py-2.5 rounded-sm border border-edge bg-surface text-sm font-medium text-ink-primary hover:border-edge-strong hover:bg-surface-muted/60 transition-colors"
            >
              Load More Products
            </button>
          </>
        )}
        {currentPage >= totalPages && totalItems > 0 && (
          <p className="text-sm text-ink-muted">All {totalItems} products loaded</p>
        )}
      </div>
    );
  }

  // Traditional pagination
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Info Text */}
      <p className="text-xs text-ink-muted">
        Showing {startItem}–{endItem} of {totalItems} products
      </p>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-2 rounded-sm border border-edge text-sm font-medium text-ink-primary hover:border-edge-strong hover:bg-surface-muted/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            if (pageNum < 1 || pageNum > totalPages) return null;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  currentPage === pageNum
                    ? 'bg-ink-primary text-white'
                    : 'border border-edge text-ink-secondary hover:border-edge-strong hover:bg-surface-muted/60'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-2 rounded-sm border border-edge text-sm font-medium text-ink-primary hover:border-edge-strong hover:bg-surface-muted/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Page Info */}
      <p className="text-[11px] text-ink-subtle">
        Page {currentPage} of {totalPages}
      </p>
    </div>
  );
}

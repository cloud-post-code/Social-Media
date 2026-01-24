import React, { useState, useEffect } from 'react';
import { BrandDNA, GeneratedAsset } from '../models/types.js';

interface HomePageProps {
  brands: BrandDNA[];
  assets: GeneratedAsset[];
  activeBrandId: string | null;
  onBrandSelect: (id: string) => void;
  onNewBrand: () => void;
  onEditAsset?: (assetId: string) => void;
  onDownloadAsset?: (asset: GeneratedAsset) => void;
  onDeleteAsset?: (assetId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ 
  brands, 
  assets, 
  activeBrandId, 
  onBrandSelect, 
  onNewBrand,
  onEditAsset,
  onDownloadAsset,
  onDeleteAsset
}) => {
  const [assetsPage, setAssetsPage] = useState(1);
  
  const itemsPerPage = 6;
  const totalPages = Math.ceil(assets.length / itemsPerPage);
  const currentPage = Math.min(assetsPage, totalPages || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const recentAssets = assets.slice(startIndex, endIndex);
  
  // Reset to page 1 when assets change (e.g., brand switch, asset deletion)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setAssetsPage(1);
    }
  }, [assets.length, totalPages, currentPage]);

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-slate-900">Dashboard</h1>
        <button
          onClick={onNewBrand}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition"
        >
          New Brand
        </button>
      </div>

      <section>
        <h2 className="text-2xl font-black text-slate-800 mb-6">Your Brands</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brands.map(brand => (
            <button
              key={brand.id}
              onClick={() => onBrandSelect(brand.id)}
              className={`p-6 rounded-2xl border-2 transition-all text-left ${
                brand.id === activeBrandId
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl"
                  style={{ backgroundColor: brand.visual_identity?.primary_color_hex || '#cbd5e1' }}
                />
                <div>
                  <h3 className="font-black text-lg">{brand.name}</h3>
                  {brand.tagline && (
                    <p className="text-sm text-slate-500">{brand.tagline}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
          {brands.length === 0 && (
            <div className="col-span-full p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-medium">No brands yet. Create your first brand!</p>
            </div>
          )}
        </div>
      </section>

      {recentAssets.length > 0 && (
        <section>
          <h2 className="text-2xl font-black text-slate-800 mb-6">Recent Assets</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recentAssets.map(asset => {
              const imageUrl = asset.imageUrl || asset.image_url;
              return (
                <div
                  key={asset.id}
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-sm relative group"
                >
                  {imageUrl && <img src={imageUrl} loading="lazy" className="w-full h-full object-cover" />}
                  
                  {/* Action buttons overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {onEditAsset && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAsset(asset.id);
                        }}
                        className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg"
                        title="Edit Asset"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {onDownloadAsset && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadAsset(asset);
                        }}
                        className="bg-white text-slate-900 p-2.5 rounded-xl hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
                        title="Download Asset"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                    {onDeleteAsset && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAsset(asset.id);
                        }}
                        className="bg-red-600 text-white p-2.5 rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-lg"
                        title="Delete Asset"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setAssetsPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-bold text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setAssetsPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default HomePage;


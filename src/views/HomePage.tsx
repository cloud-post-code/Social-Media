import React from 'react';
import { BrandDNA, GeneratedAsset } from '../models/types.js';

interface HomePageProps {
  brands: BrandDNA[];
  assets: GeneratedAsset[];
  activeBrandId: string | null;
  onBrandSelect: (id: string) => void;
  onNewBrand: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ 
  brands, 
  assets, 
  activeBrandId, 
  onBrandSelect, 
  onNewBrand 
}) => {
  const recentAssets = assets.slice(0, 8);

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
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-sm"
                >
                  {imageUrl && <img src={imageUrl} className="w-full h-full object-cover" />}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;


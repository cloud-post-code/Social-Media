import React, { useState, useEffect } from 'react';
import { BrandDNA, GeneratedAsset } from './models/types.js';
import { useBrands } from './hooks/useBrands.js';
import { useAssets } from './hooks/useAssets.js';
import BrandDNAPage from './views/BrandDNAPage.js';
import ContentStudioPage from './views/ContentStudioPage.js';
import HomePage from './views/HomePage.js';
import LoadingSpinner from './components/LoadingSpinner.js';
import ErrorMessage from './components/ErrorMessage.js';

const App: React.FC = () => {
  const { brands, loading: brandsLoading, error: brandsError, createBrand, updateBrand } = useBrands();
  const { assets, loading: assetsLoading, createAsset } = useAssets();
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'dna' | 'studio'>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const activeBrand = brands.find(b => b.id === activeBrandId) || null;
  const editingAsset = editingAssetId ? assets.find(a => a.id === editingAssetId) : null;

  useEffect(() => {
    if (brands.length > 0 && !activeBrandId) {
      setActiveBrandId(brands[0].id);
    }
  }, [brands, activeBrandId]);

  const handleSaveBrand = async (dna: BrandDNA): Promise<BrandDNA> => {
    try {
      // Check if brand already exists (might have been created during extraction)
      const existingBrand = brands.find(b => b.id === dna.id);
      
      if (existingBrand) {
        // Update existing brand
        const updated = await updateBrand(dna.id, dna);
        setView('studio');
        return updated;
      } else {
        // Create new brand (or update if ID exists in database but not in local state)
        try {
          const newBrand = await createBrand(dna);
          setActiveBrandId(newBrand.id);
          setView('studio');
          return newBrand;
        } catch (createErr: any) {
          // If creation fails because brand already exists, try to update instead
          if (createErr.message?.includes('already exists') || createErr.statusCode === 409) {
            const updated = await updateBrand(dna.id, dna);
            setActiveBrandId(updated.id);
            setView('studio');
            return updated;
          }
          throw createErr;
        }
      }
    } catch (err) {
      alert('Failed to save brand: ' + (err as Error).message);
      throw err;
    }
  };

  const handleAssetCreated = async (asset: GeneratedAsset) => {
    await createAsset(asset);
    setEditingAssetId(null); // Clear editing state after creation
  };

  // Handle editing an asset
  const handleEditAsset = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    
    // Set the brand as active if it's not already
    if (asset.brand_id || asset.brandId) {
      const brandId = asset.brand_id || asset.brandId;
      setActiveBrandId(brandId);
    }
    
    setEditingAssetId(assetId);
    setView('studio');
  };

  // Handle downloading an asset
  const handleDownloadAsset = async (asset: GeneratedAsset) => {
    const imageUrl = asset.imageUrl || asset.image_url;
    if (!imageUrl) return;

    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create a temporary URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asset-${asset.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download asset:', error);
      alert('Failed to download asset. Please try again.');
    }
  };

  if (brandsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f1f5f9] text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-500 ease-in-out flex flex-col ${sidebarOpen ? 'w-80' : 'w-0'} overflow-hidden shadow-sm z-20`}>
        <div className="p-10 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-black tracking-tighter text-indigo-600 flex items-center gap-3">
            <div className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center italic shadow-lg shadow-indigo-200 rotate-3">B</div>
            BrandGenius
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-10 custom-scrollbar">
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Your Libraries</h2>
              <button 
                onClick={() => { setActiveBrandId(null); setView('dna'); }}
                className="bg-indigo-50 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-90"
                title="New Brand"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            <div className="space-y-2">
              {brands.map(brand => (
                <button
                  key={brand.id}
                  onClick={() => { setActiveBrandId(brand.id); setView('studio'); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${brand.id === activeBrandId ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                >
                  <div 
                    className="w-5 h-5 rounded-full shrink-0 border-2 border-white group-hover:scale-110 transition" 
                    style={{ backgroundColor: brand.visual_identity?.primary_color_hex || '#cbd5e1' }} 
                  />
                  <span className="font-bold text-sm truncate">{brand.name}</span>
                </button>
              ))}
              {brands.length === 0 && (
                <div className="p-6 bg-slate-50 rounded-2xl text-center border-2 border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400">No brands yet.</p>
                </div>
              )}
            </div>
          </section>

          {assets.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Recent Assets</h2>
              <div className="grid grid-cols-2 gap-3 px-1">
                {assets.slice(0, 8).map(asset => {
                  const imageUrl = asset.imageUrl || asset.image_url;
                  return (
                    <div 
                      key={asset.id} 
                      className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-sm cursor-pointer hover:ring-4 hover:ring-indigo-500/20 transition-all hover:scale-[1.05] relative group"
                    >
                      {imageUrl && <img src={imageUrl} className="w-full h-full object-cover" />}
                      
                      {/* Action buttons overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAsset(asset.id);
                          }}
                          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg"
                          title="Edit Asset"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadAsset(asset);
                          }}
                          className="bg-white text-slate-900 p-2.5 rounded-xl hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
                          title="Download Asset"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
          <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Status</p>
              <p className="text-sm font-black mb-4">Enterprise Mode</p>
              <button className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-xs hover:bg-indigo-50 transition active:scale-95">Manage Plan</button>
            </div>
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 blur-2xl rounded-full group-hover:scale-150 transition-all duration-700"></div>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-24 bg-white/80 backdrop-blur-2xl border-b border-slate-200 px-10 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-2xl text-slate-500 transition active:scale-90"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button 
                onClick={() => setView('home')}
                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'home' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 HOME
               </button>
               <button 
                onClick={() => setView('dna')}
                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'dna' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 DNA LIBRARY
               </button>
               <button 
                onClick={() => { if(activeBrand) setView('studio'); }}
                disabled={!activeBrand}
                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'studio' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30'}`}
               >
                 CONTENT STUDIO
               </button>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {activeBrand && (
              <div className="flex items-center gap-5 pr-6 border-r border-slate-100">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Brand</p>
                  <p className="text-sm font-black text-slate-900">{activeBrand.name}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl shadow-inner border border-slate-100" style={{ backgroundColor: activeBrand.visual_identity?.primary_color_hex || '#cbd5e1' }} />
              </div>
            )}
            <button className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 hover:scale-105 active:scale-95 transition-all">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/50">
          {brandsError && (
            <div className="mb-6">
              <ErrorMessage message={brandsError} />
            </div>
          )}
          {view === 'home' && (
            <HomePage
              brands={brands}
              assets={assets}
              activeBrandId={activeBrandId}
              onBrandSelect={(id) => { setActiveBrandId(id); setView('studio'); }}
              onNewBrand={() => { setActiveBrandId(null); setView('dna'); }}
              onEditAsset={handleEditAsset}
              onDownloadAsset={handleDownloadAsset}
            />
          )}
          {view === 'dna' && (
            <BrandDNAPage 
              activeBrand={activeBrand}
              onSave={handleSaveBrand}
              onCancel={() => {
                if (brands.length > 0) {
                   setActiveBrandId(brands[0].id);
                   setView('studio');
                } else {
                  setView('home');
                }
              }}
            />
          )}
          {view === 'studio' && (
            <ContentStudioPage 
              activeBrand={activeBrand}
              onAssetCreated={handleAssetCreated}
              initialAsset={editingAsset}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;


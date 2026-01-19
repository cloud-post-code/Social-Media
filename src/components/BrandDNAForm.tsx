import React, { useState, useEffect } from 'react';
import { BrandDNA } from '../models/types.js';
import { brandApi } from '../services/brandApi.js';
import { useBrandAssets } from '../hooks/useBrandAssets.js';
import ColorPicker from './ColorPicker.js';

interface BrandDNAFormProps {
  dna: Partial<BrandDNA>;
  onSave: (dna: BrandDNA) => Promise<BrandDNA>;
  onCancel: () => void;
}

const BrandDNAForm: React.FC<BrandDNAFormProps> = ({ dna, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<BrandDNA>>(dna);
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedAssets, setExtractedAssets] = useState<{ logoUrl?: string; imageUrls?: string[] } | null>(null);
  
  const brandId = formData.id;
  const { assets, logo, loading: assetsLoading, uploadAsset, deleteAsset, loadAssets } = useBrandAssets(brandId);

  // Sync state if prop changes
  useEffect(() => {
    setFormData(dna);
    if (dna.id) {
      loadAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dna]);

  // Save extracted assets when brandId becomes available (for existing brands being updated)
  useEffect(() => {
    if (extractedAssets && brandId && formData.id === brandId) {
      const saveExtractedAssets = async () => {
        try {
          if (extractedAssets.logoUrl) {
            try {
              await uploadAsset(extractedAssets.logoUrl, 'logo');
            } catch (err: any) {
              // Logo might already exist, that's ok
              if (!err.message?.includes('already has a logo')) {
                console.error('Failed to save logo:', err);
              }
            }
          }
          if (extractedAssets.imageUrls && extractedAssets.imageUrls.length > 0) {
            for (const imageUrl of extractedAssets.imageUrls.slice(0, 10)) {
              try {
                await uploadAsset(imageUrl, 'brand_image');
              } catch (err: any) {
                if (err.message?.includes('Maximum')) {
                  break; // Reached max limit
                }
                console.error('Failed to save image:', err);
              }
            }
          }
          setExtractedAssets(null);
          await loadAssets();
        } catch (err) {
          console.error('Failed to save extracted assets:', err);
        }
      };
      saveExtractedAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, extractedAssets]);

  const handleExtract = async () => {
    if (!urlInput) return;
    
    // Validate and format URL
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    setIsExtracting(true);
    try {
      // Extract and auto-save: create brand immediately with assets
      const extracted: any = await brandApi.extractDNA({ url, autoSave: true });
      
      // Brand is already created and saved with assets
      setFormData(extracted);
      setUrlInput(''); // Clear input after successful extraction
      
      // Update local state by calling onSave to refresh brands list
      try {
        await onSave(extracted);
      } catch (err) {
        // Brand might already exist, that's ok
        console.log('Brand save note:', err);
      }
      
      // Wait a bit for database to commit, then reload assets
      if (extracted.id) {
        setTimeout(async () => {
          try {
            await loadAssets();
            console.log('Assets reloaded after extraction');
          } catch (err) {
            console.error('Failed to reload assets:', err);
          }
        }, 1000); // Increased delay to ensure DB commit
      }
      
      // Show success message
      alert('Brand DNA extracted and saved successfully!');
    } catch (err: any) {
      const errorMessage = err?.message || 'Extraction failed. Please ensure the URL is valid and accessible.';
      alert(`Extraction failed: ${errorMessage}`);
      console.error('DNA extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        // Extract DNA from screenshot (no autoSave for screenshots since they don't have URLs for image extraction)
        const extracted: any = await brandApi.extractDNA({ imageBase64: base64 });
        
        // Extract assets info if present (though screenshots won't have extracted assets)
        if (extracted.extractedAssets) {
          setExtractedAssets(extracted.extractedAssets);
          delete extracted.extractedAssets;
        }
        
        setFormData(extracted);
      } catch (err) {
        alert('Failed to analyze screenshot.');
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, assetType: 'logo' | 'brand_image') => {
    const file = e.target.files?.[0];
    if (!file || !brandId) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        await uploadAsset(base64, assetType);
      } catch (err: any) {
        alert(err.message || 'Failed to upload image.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAssetDelete = async (assetId: string, assetType: 'logo' | 'brand_image') => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    try {
      await deleteAsset(assetId, assetType);
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset.');
    }
  };

  const updateNested = (path: string, value: any) => {
    const keys = path.split('.');
    setFormData((prev: any) => {
      const newData = { ...prev };
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData: BrandDNA = {
      id: formData.id || Date.now().toString(),
      name: formData.name || 'Untitled Brand',
      tagline: formData.tagline || '',
      overview: formData.overview || '',
      visual_identity: {
        primary_color_hex: formData.visual_identity?.primary_color_hex || '#4F46E5',
        accent_color_hex: formData.visual_identity?.accent_color_hex || '#F59E0B',
        background_style: formData.visual_identity?.background_style || 'Clean white',
        imagery_style: formData.visual_identity?.imagery_style || 'Professional photography',
        font_vibe: formData.visual_identity?.font_vibe || 'Sans-serif modern',
        logo_style: formData.visual_identity?.logo_style || 'Minimalist'
      },
      brand_voice: {
        tone_adjectives: formData.brand_voice?.tone_adjectives || ['Professional', 'Helpful'],
        writing_style: formData.brand_voice?.writing_style || 'Direct and clear',
        keywords_to_use: formData.brand_voice?.keywords_to_use || [],
        taboo_words: formData.brand_voice?.taboo_words || []
      },
      strategic_profile: {
        target_audience: formData.strategic_profile?.target_audience || 'General',
        core_value_prop: formData.strategic_profile?.core_value_prop || 'Quality products',
        product_category: formData.strategic_profile?.product_category || 'General'
      }
    };
    
    // Save brand (create or update)
    const savedBrand = await onSave(finalData);
    
    // If there are extracted assets that weren't saved yet (e.g., from screenshot extraction), save them now
    if (extractedAssets && savedBrand.id) {
      try {
        const { brandAssetApi } = await import('../services/brandAssetApi.js');
        
        // Save logo if extracted
        if (extractedAssets.logoUrl) {
          try {
            await brandAssetApi.uploadAsset(savedBrand.id, extractedAssets.logoUrl, 'logo');
          } catch (err: any) {
            // Logo might already exist, that's ok
            if (!err.message?.includes('already has a logo')) {
              console.error('Failed to save logo:', err);
            }
          }
        }
        
        // Save brand images if extracted
        if (extractedAssets.imageUrls && extractedAssets.imageUrls.length > 0) {
          for (const imageUrl of extractedAssets.imageUrls.slice(0, 10)) {
            try {
              await brandAssetApi.uploadAsset(savedBrand.id, imageUrl, 'brand_image');
            } catch (err: any) {
              if (err.message?.includes('Maximum')) {
                break; // Reached max limit
              }
              console.error('Failed to save image:', err);
            }
          }
        }
        
        setExtractedAssets(null);
        // Reload assets to show them
        setTimeout(() => {
          loadAssets();
        }, 500);
      } catch (err) {
        console.error('Failed to save extracted assets:', err);
      }
    }
    
    // Update formData with saved brand
    setFormData({ ...savedBrand });
  };

  const canUploadMoreImages = assets.length < 10;
  const hasLogo = !!logo;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Extraction Header */}
      <section className="bg-gradient-to-br from-slate-900 to-indigo-950 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">Build from existing brand</h2>
          <p className="text-slate-300 mb-8 max-w-xl">Enter a website URL or upload a screenshot to let BrandGenius AI reverse-engineer your brand's DNA instantly.</p>
          
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex bg-white/10 backdrop-blur-xl rounded-2xl p-1.5 border border-white/20 focus-within:border-indigo-400 transition">
              <input 
                type="text" 
                placeholder="https://brand-website.com"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="bg-transparent flex-1 px-5 py-4 outline-none text-white placeholder:text-white/40 font-medium"
              />
              <button 
                onClick={handleExtract}
                disabled={isExtracting}
                className="bg-white text-slate-900 px-8 py-4 rounded-xl font-black hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50"
              >
                {isExtracting ? 'Analyzing...' : 'Auto-Generate'}
              </button>
            </div>
            <div className="flex gap-2">
              <label className="flex flex-1 lg:flex-none items-center justify-center bg-indigo-600/20 border border-white/20 px-8 py-4 rounded-2xl cursor-pointer hover:bg-indigo-600/30 transition active:scale-95">
                <span className="font-bold text-sm">Upload Screenshot</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full"></div>
      </section>

      {/* Manual Form */}
      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Brand DNA Profile</h2>
            <p className="text-slate-500 font-medium">Configure the core identity markers for this library.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-8 py-3 text-slate-500 font-bold hover:text-slate-800 transition">Discard</button>
            <button type="submit" className="flex-1 md:flex-none px-10 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95">Save Profile</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Identity & Strategy */}
          <div className="lg:col-span-7 space-y-10">
            <section>
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Strategic Profile</h3>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Brand Name</label>
                    <input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition outline-none" placeholder="e.g. Nike" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Tagline</label>
                    <input value={formData.tagline || ''} onChange={e => setFormData({...formData, tagline: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition outline-none" placeholder="e.g. Just Do It" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Paragraph Overview</label>
                  <textarea rows={3} value={formData.overview || ''} onChange={e => setFormData({...formData, overview: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition outline-none" placeholder="Describe the brand essence..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Product Category</label>
                    <input value={formData.strategic_profile?.product_category || ''} onChange={e => updateNested('strategic_profile.product_category', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Target Audience</label>
                    <input value={formData.strategic_profile?.target_audience || ''} onChange={e => updateNested('strategic_profile.target_audience', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Voice & Personality</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Tone Adjectives (comma separated)</label>
                  <input value={formData.brand_voice?.tone_adjectives?.join(', ') || ''} onChange={e => updateNested('brand_voice.tone_adjectives', e.target.value.split(',').map(s => s.trim()))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="e.g. Bold, Energetic, Trustworthy" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Writing Style</label>
                  <textarea rows={2} value={formData.brand_voice?.writing_style || ''} onChange={updateNested.bind(null, 'brand_voice.writing_style')} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="e.g. Short, punchy fragments." />
                </div>
              </div>
            </section>
          </div>

          {/* Visuals & Creative */}
          <div className="lg:col-span-5 space-y-10">
            <section>
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Visual Identity</h3>
              <div className="bg-slate-50 p-6 rounded-3xl space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Primary Color</label>
                  <ColorPicker
                    value={formData.visual_identity?.primary_color_hex || '#4F46E5'}
                    onChange={(hex) => updateNested('visual_identity.primary_color_hex', hex)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Accent Color</label>
                  <ColorPicker
                    value={formData.visual_identity?.accent_color_hex || '#F59E0B'}
                    onChange={(hex) => updateNested('visual_identity.accent_color_hex', hex)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Background Style</label>
                  <input value={formData.visual_identity?.background_style || ''} onChange={e => updateNested('visual_identity.background_style', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Imagery Style</label>
                  <input value={formData.visual_identity?.imagery_style || ''} onChange={e => updateNested('visual_identity.imagery_style', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Typography Vibe</label>
                  <input value={formData.visual_identity?.font_vibe || ''} onChange={e => updateNested('visual_identity.font_vibe', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl" />
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Brand Assets Section */}
        {brandId && (
          <section className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-6">
              Brand Assets
              {assetsLoading && <span className="ml-2 text-sm text-slate-400 font-normal">(Loading...)</span>}
            </h3>
            
            {/* Logo Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Logo</h4>
                {!hasLogo && (
                  <label className="text-xs text-indigo-600 font-bold cursor-pointer hover:text-indigo-700 transition">
                    + Upload Logo
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleAssetUpload(e, 'logo')}
                    />
                  </label>
                )}
              </div>
              {hasLogo ? (
                <div className="relative inline-block group">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <img
                      src={logo.image_url}
                      alt="Brand logo"
                      className="max-w-xs max-h-24 object-contain"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                        // Show error message
                        const parent = img.parentElement;
                        if (parent && !parent.querySelector('.error-message')) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'error-message text-red-500 text-xs mt-2 text-center';
                          errorDiv.textContent = 'Failed to load image';
                          parent.appendChild(errorDiv);
                        }
                        console.error('Failed to load logo image:', logo.image_url);
                      }}
                      onLoad={() => {
                        console.log('Logo loaded successfully:', logo.image_url.substring(0, 50));
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssetDelete(logo.id, 'logo')}
                    className="absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 text-sm font-medium">No logo uploaded</p>
                </div>
              )}
            </div>

            {/* Brand Images Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Brand Images ({assets.length} / 10)
                </h4>
                {canUploadMoreImages && (
                  <label className="text-xs text-indigo-600 font-bold cursor-pointer hover:text-indigo-700 transition">
                    + Upload Image
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleAssetUpload(e, 'brand_image')}
                    />
                  </label>
                )}
              </div>
              {assets.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {assets.map((asset) => (
                    <div key={asset.id} className="relative group aspect-square rounded-xl overflow-hidden bg-white border border-slate-200">
                      <img
                        src={asset.image_url}
                        alt={`Brand image ${asset.id}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          // Show error indicator
                          const parent = img.parentElement;
                          if (parent && !parent.querySelector('.error-indicator')) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error-indicator absolute inset-0 flex items-center justify-center bg-red-50';
                            errorDiv.innerHTML = '<span class="text-red-500 text-xs">Failed to load</span>';
                            parent.appendChild(errorDiv);
                          }
                          console.error('Failed to load brand image:', asset.image_url.substring(0, 50));
                        }}
                        onLoad={() => {
                          console.log('Brand image loaded successfully:', asset.image_url.substring(0, 50));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAssetDelete(asset.id, 'brand_image')}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold">Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 text-sm font-medium mb-2">No brand images yet</p>
                  {canUploadMoreImages && (
                    <label className="text-xs text-indigo-600 font-bold cursor-pointer hover:text-indigo-700 transition inline-block">
                      + Upload First Image
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleAssetUpload(e, 'brand_image')}
                      />
                    </label>
                  )}
                </div>
              )}
              {!canUploadMoreImages && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-800">Maximum of 10 images reached. Delete an image to upload a new one.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </form>
    </div>
  );
};

export default BrandDNAForm;

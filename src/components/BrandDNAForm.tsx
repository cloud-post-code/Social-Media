import React, { useState, useEffect } from 'react';
import { BrandDNA } from '../models/types.js';
import { brandApi } from '../services/brandApi.js';
import { brandAssetApi } from '../services/brandAssetApi.js';
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
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [isAddingColor, setIsAddingColor] = useState(false);
  
  const brandId = formData.id;
  const { assets, logo, loading: assetsLoading, uploadAsset, deleteAsset, loadAssets } = useBrandAssets(brandId);

  // Sync state if prop changes
  useEffect(() => {
    setFormData(dna);
    if (dna.id) {
      loadAssets();
    } else {
      // Reset extraction-related state when creating a new brand
      setUrlInput('');
      setExtractedAssets(null);
      setIsExtracting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dna]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close if clicking outside color picker elements
      if (editingColorIndex !== null && !target.closest('.color-picker-container')) {
        setEditingColorIndex(null);
      }
      if (isAddingColor && !target.closest('.color-picker-container')) {
        setIsAddingColor(false);
      }
    };
    
    if (editingColorIndex !== null || isAddingColor) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingColorIndex, isAddingColor]);

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
            for (const imageUrl of extractedAssets.imageUrls) {
              try {
                await uploadAsset(imageUrl, 'brand_image');
              } catch (err: any) {
                console.error('Failed to save image:', err);
              }
            }
          }
          setExtractedAssets(null);
          await loadAssets();
        } catch (err) {
          console.error('Failed to save extracted assets:', err);
          // Don't let this error block - clear extracted assets anyway
          setExtractedAssets(null);
        }
      };
      saveExtractedAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, extractedAssets, assets.length]);

  const handleExtract = async () => {
    if (!urlInput) return;
    
    // Validate and format URL
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    setIsExtracting(true);
    const extractionSteps = [
      { name: 'Basic Info', key: 'basicInfo' },
      { name: 'Visual Identity', key: 'visualIdentity' },
      { name: 'Brand Voice', key: 'brandVoice' },
      { name: 'Strategic Profile', key: 'strategicProfile' },
      { name: 'Brand Images', key: 'images' }
    ];
    
    try {
      console.log('[Extraction] Starting multi-step extraction for:', url);
      
      // Step 1: Extract Basic Info
      console.log('[Extraction] Step 1/5: Extracting basic info...');
      const basicInfo = await brandApi.extractBasicInfo({ url });
      console.log('[Extraction] Step 1/5: Basic info extracted:', basicInfo.name);
      
      // Step 2: Extract Visual Identity
      console.log('[Extraction] Step 2/5: Extracting visual identity...');
      let visualIdentity;
      try {
        visualIdentity = await brandApi.extractVisualIdentity({ url });
        console.log('[Extraction] Step 2/5: Visual identity extracted');
      } catch (err: any) {
        console.warn('[Extraction] Step 2/5: Visual identity extraction failed, using defaults:', err.message);
        visualIdentity = {
          primary_color_hex: '#4F46E5',
          accent_color_hex: '#F59E0B',
          background_style: '',
          imagery_style: '',
          font_vibe: '',
          logo_style: ''
        };
      }
      
      // Step 3: Extract Brand Voice
      console.log('[Extraction] Step 3/5: Extracting brand voice...');
      let brandVoice;
      try {
        brandVoice = await brandApi.extractBrandVoice({ url });
        console.log('[Extraction] Step 3/5: Brand voice extracted');
      } catch (err: any) {
        console.warn('[Extraction] Step 3/5: Brand voice extraction failed, using defaults:', err.message);
        brandVoice = {
          tone_adjectives: [],
          writing_style: '',
          keywords_to_use: [],
          taboo_words: []
        };
      }
      
      // Step 4: Extract Strategic Profile
      console.log('[Extraction] Step 4/5: Extracting strategic profile...');
      let strategicProfile;
      try {
        strategicProfile = await brandApi.extractStrategicProfile({ url });
        console.log('[Extraction] Step 4/5: Strategic profile extracted');
      } catch (err: any) {
        console.warn('[Extraction] Step 4/5: Strategic profile extraction failed, using defaults:', err.message);
        strategicProfile = {
          target_audience: '',
          core_value_prop: '',
          product_category: ''
        };
      }
      
      // Step 5: Extract Brand Images
      console.log('[Extraction] Step 5/5: Extracting brand images from URL:', url);
      let extractedAssets: { logoUrl?: string; imageUrls?: string[] } = {};
      try {
        const imagesResult = await brandApi.extractBrandImages(url);
        console.log('[Extraction] Step 5/5: Raw images result:', imagesResult);
        extractedAssets = imagesResult;
        console.log('[Extraction] Step 5/5: Brand images extracted:', {
          logo: imagesResult.logoUrl ? `found (${imagesResult.logoUrl.substring(0, 50)}...)` : 'not found',
          images: imagesResult.imageUrls?.length || 0,
          imageUrls: imagesResult.imageUrls?.slice(0, 3).map(u => u.substring(0, 50)) || []
        });
      } catch (err: any) {
        console.error('[Extraction] Step 5/5: Brand images extraction failed:', err);
        console.error('[Extraction] Step 5/5: Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        extractedAssets = {};
      }
      
      // Combine all extracted data into BrandDNA format
      const brandId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const extracted: BrandDNA = {
        id: brandId,
        name: basicInfo.name,
        tagline: basicInfo.tagline,
        overview: basicInfo.overview,
        visual_identity: visualIdentity,
        brand_voice: brandVoice,
        strategic_profile: strategicProfile
      };
      
      // Create brand with autoSave
      console.log('[Extraction] Creating brand in database...');
      const createdBrand = await brandApi.create(extracted);
      
      // Save extracted assets
      console.log('[Extraction] Checking extracted assets to save:', {
        hasLogo: !!extractedAssets.logoUrl,
        logoUrl: extractedAssets.logoUrl?.substring(0, 50),
        imageCount: extractedAssets.imageUrls?.length || 0,
        imageUrls: extractedAssets.imageUrls?.slice(0, 3).map(u => u.substring(0, 50))
      });
      
      if (extractedAssets.logoUrl || (extractedAssets.imageUrls && extractedAssets.imageUrls.length > 0)) {
        console.log('[Extraction] Saving extracted assets to brand:', createdBrand.id);
        let savedLogo = false;
        let savedImages = 0;
        
        try {
          if (extractedAssets.logoUrl) {
            try {
              console.log('[Extraction] Attempting to save logo:', extractedAssets.logoUrl.substring(0, 100));
              await brandAssetApi.uploadAsset(createdBrand.id, extractedAssets.logoUrl, 'logo');
              savedLogo = true;
              console.log('[Extraction] ✓ Logo saved successfully');
            } catch (err: any) {
              console.error('[Extraction] ✗ Failed to save logo:', {
                error: err.message,
                response: err.response?.data,
                logoUrl: extractedAssets.logoUrl?.substring(0, 100)
              });
            }
          } else {
            console.log('[Extraction] No logo URL to save');
          }
          
          if (extractedAssets.imageUrls && extractedAssets.imageUrls.length > 0) {
            console.log(`[Extraction] Attempting to save ${extractedAssets.imageUrls.length} brand images...`);
            for (let i = 0; i < extractedAssets.imageUrls.length; i++) {
              const imageUrl = extractedAssets.imageUrls[i];
              try {
                console.log(`[Extraction] Saving image ${i + 1}/${extractedAssets.imageUrls.length}: ${imageUrl.substring(0, 100)}...`);
                await brandAssetApi.uploadAsset(createdBrand.id, imageUrl, 'brand_image');
                savedImages++;
                console.log(`[Extraction] ✓ Image ${i + 1} saved successfully`);
              } catch (err: any) {
                console.error(`[Extraction] ✗ Failed to save image ${i + 1}:`, {
                  error: err.message,
                  response: err.response?.data,
                  imageUrl: imageUrl.substring(0, 100)
                });
              }
            }
            console.log(`[Extraction] Saved ${savedImages} out of ${extractedAssets.imageUrls.length} brand images`);
          } else {
            console.log('[Extraction] No brand image URLs to save');
          }
          
          console.log('[Extraction] Asset saving summary:', {
            logo: savedLogo ? 'saved' : 'not saved',
            images: `${savedImages} saved`
          });
        } catch (err) {
          console.error('[Extraction] Error saving assets:', err);
        }
      } else {
        console.warn('[Extraction] No assets to save - extractedAssets is empty');
      }
      
      // Update form data
      setFormData(createdBrand);
      setUrlInput(''); // Clear input after successful extraction
      
      // Update local state by calling onSave to refresh brands list
      try {
        await onSave(createdBrand);
      } catch (err) {
        console.log('Brand save note:', err);
      }
      
      // Wait a bit for database to commit, then reload assets
      setTimeout(async () => {
        try {
          await loadAssets();
          console.log('[Extraction] Assets reloaded');
        } catch (err) {
          console.error('Failed to reload assets:', err);
        }
      }, 1000);
      
      // Show success message
      alert('Brand DNA extracted and saved successfully!');
      console.log('[Extraction] Extraction completed successfully');
    } catch (err: any) {
      const errorMessage = err?.message || 'Extraction failed. Please ensure the URL is valid and accessible.';
      alert(`Extraction failed: ${errorMessage}`);
      console.error('[Extraction] DNA extraction error:', err);
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
        const errorMessage = err.message || 'Failed to upload image.';
        alert(errorMessage);
        console.error('Upload failed:', err);
      } finally {
        e.target.value = ''; // Reset file input after upload attempt
      }
    };
    reader.onerror = () => {
      alert('Failed to read file.');
      e.target.value = ''; // Reset file input
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
    
    // Ensure colors array has at least 4 colors
    let colors = formData.visual_identity?.colors || [];
    if (colors.length < 4) {
      while (colors.length < 4) {
        if (colors.length === 0) {
          colors = ['#4F46E5', '#F59E0B', '#FFFFFF', '#000000'];
        } else if (colors.length === 1) {
          colors.push('#F59E0B', '#FFFFFF', '#000000');
        } else if (colors.length === 2) {
          colors.push('#FFFFFF', '#000000');
        } else if (colors.length === 3) {
          colors.push('#808080');
        }
      }
    }
    
    const finalData: BrandDNA = {
      id: formData.id || Date.now().toString(),
      name: formData.name || 'Untitled Brand',
      tagline: formData.tagline || '',
      overview: formData.overview || '',
      visual_identity: {
        primary_color_hex: formData.visual_identity?.primary_color_hex || '#4F46E5',
        accent_color_hex: formData.visual_identity?.accent_color_hex || '#F59E0B',
        colors: colors,
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
    // Note: This happens AFTER the brand is saved, so errors here won't block the save
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
          for (const imageUrl of extractedAssets.imageUrls) {
            try {
              await brandAssetApi.uploadAsset(savedBrand.id, imageUrl, 'brand_image');
            } catch (err: any) {
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
        // Don't let this error prevent the save from completing - clear extracted assets anyway
        setExtractedAssets(null);
      }
    }
    
    // Update formData with saved brand
    setFormData({ ...savedBrand });
  };

  const hasLogo = !!logo;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Extraction Header - Only show when creating a new brand */}
      {!formData.id && (
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
      )}

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
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
                    Colors
                  </label>
                  <div className="flex flex-wrap gap-6">
                    {(() => {
                      // Ensure at least 4 colors are displayed
                      let colors = formData.visual_identity?.colors || [];
                      if (colors.length < 4) {
                        while (colors.length < 4) {
                          if (colors.length === 0) {
                            colors = ['#4F46E5', '#F59E0B', '#FFFFFF', '#000000'];
                          } else if (colors.length === 1) {
                            colors.push('#F59E0B', '#FFFFFF', '#000000');
                          } else if (colors.length === 2) {
                            colors.push('#FFFFFF', '#000000');
                          } else if (colors.length === 3) {
                            colors.push('#808080');
                          }
                        }
                        // Update formData if we had to add default colors
                        if (!formData.visual_identity?.colors || formData.visual_identity.colors.length < 4) {
                          updateNested('visual_identity.colors', colors);
                        }
                      }
                      return colors;
                    })().map((color, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center gap-2 group relative"
                      >
                        {editingColorIndex === index ? (
                          <div className="absolute z-50 top-0 left-0 color-picker-container">
                            <ColorPicker
                              value={color}
                              onChange={(newColor) => {
                                const newColors = [...(formData.visual_identity?.colors || [])];
                                newColors[index] = newColor.toUpperCase();
                                updateNested('visual_identity.colors', newColors);
                                setEditingColorIndex(null);
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <div
                              className="w-16 h-16 rounded-full border-2 border-slate-200 shadow-sm transition-all hover:scale-110 hover:shadow-md cursor-pointer"
                              style={{ backgroundColor: color }}
                              onClick={() => setEditingColorIndex(index)}
                              title={`Click to edit ${color}`}
                            />
                            <span className="text-xs font-mono text-slate-400 font-medium">{color}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newColors = [...(formData.visual_identity?.colors || [])];
                                newColors.splice(index, 1);
                                // Ensure minimum 4 colors
                                if (newColors.length < 4) {
                                  while (newColors.length < 4) {
                                    if (newColors.length === 0) {
                                      newColors.push('#4F46E5', '#F59E0B', '#FFFFFF', '#000000');
                                    } else if (newColors.length === 1) {
                                      newColors.push('#F59E0B', '#FFFFFF', '#000000');
                                    } else if (newColors.length === 2) {
                                      newColors.push('#FFFFFF', '#000000');
                                    } else if (newColors.length === 3) {
                                      newColors.push('#808080');
                                    }
                                  }
                                }
                                updateNested('visual_identity.colors', newColors.length > 0 ? newColors : undefined);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 text-xs font-bold -mt-1"
                              title="Remove color"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {/* Add Color Button */}
                    {isAddingColor ? (
                      <div className="flex flex-col items-center gap-2 relative color-picker-container">
                        <div className="absolute z-50 top-0 left-0">
                          <ColorPicker
                            value="#000000"
                            onChange={(newColor) => {
                              const currentColors = formData.visual_identity?.colors || [];
                              const newColors = [...currentColors, newColor.toUpperCase()];
                              updateNested('visual_identity.colors', newColors);
                              setIsAddingColor(false);
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center gap-2 cursor-pointer"
                        onClick={() => setIsAddingColor(true)}
                      >
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:bg-slate-100 hover:border-slate-400 transition-all hover:scale-110">
                          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <span className="text-xs font-mono text-slate-400 font-medium">Add Color</span>
                      </div>
                    )}
                  </div>
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
                      loading="lazy"
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
                  Brand Images ({assets.length})
                </h4>
                <label className="text-xs text-indigo-600 font-bold cursor-pointer hover:text-indigo-700 transition">
                  + Upload Image
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleAssetUpload(e, 'brand_image')}
                  />
                </label>
              </div>
              {assets.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {assets.map((asset) => (
                    <div key={asset.id} className="relative group aspect-square rounded-xl overflow-hidden bg-white border border-slate-200">
                      <img
                        src={asset.image_url}
                        alt={`Brand image ${asset.id}`}
                        loading="lazy"
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
                  <label className="text-xs text-indigo-600 font-bold cursor-pointer hover:text-indigo-700 transition inline-block">
                    + Upload First Image
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleAssetUpload(e, 'brand_image')}
                    />
                  </label>
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

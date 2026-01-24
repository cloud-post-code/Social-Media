import React, { useState } from 'react';
import { BrandDNA, GeneratedAsset, GenerationOption } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';

interface AssetCreationPageProps {
  activeBrand: BrandDNA | null;
  onAssetCreated: (asset: GeneratedAsset) => void;
  onCancel: () => void;
}

const AssetCreationPage: React.FC<AssetCreationPageProps> = ({ activeBrand, onAssetCreated, onCancel }) => {
  const [option, setOption] = useState<GenerationOption>('product');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  const [productFocus, setProductFocus] = useState('');
  const [userPurpose, setUserPurpose] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  
  // Image size selector state
  const [imageSizePreset, setImageSizePreset] = useState<'story' | 'square' | 'custom'>('square');
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(1080);

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setProductImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Helper function to get image dimensions based on preset
  const getImageDimensions = () => {
    switch (imageSizePreset) {
      case 'story':
        return { width: 1080, height: 1920 };
      case 'square':
        return { width: 1080, height: 1080 };
      case 'custom':
        return { width: customWidth, height: customHeight };
      default:
        return { width: 1080, height: 1080 };
    }
  };

  const handleGenerate = async () => {
    if (!activeBrand) return;
    setLoading(true);
    setStatusText('Creative Director is mapping the vision...');
    
    try {
      let asset: GeneratedAsset;

      if (option === 'product') {
        const dimensions = getImageDimensions();
        asset = await assetApi.generateProduct({
          brandId: activeBrand.id,
          productFocus,
          referenceImageBase64: productImage || undefined,
          width: dimensions.width,
          height: dimensions.height
        });
        setStatusText('Capturing high-fidelity visual...');
      } else {
        asset = await assetApi.generateNonProduct({
          brandId: activeBrand.id,
          userPurpose
        });
        setStatusText('Visualizing abstract metaphor...');
      }

      // Convert backend format to frontend format for display
      const frontendAsset: GeneratedAsset = {
        ...asset,
        imageUrl: asset.image_url,
        brandId: asset.brand_id,
        campaignImages: asset.campaign_images,
        overlayConfig: asset.overlay_config,
        baseImageUrl: asset.base_image_url,
        userPrompt: asset.user_prompt,
        feedbackHistory: asset.feedback_history,
        timestamp: asset.created_at ? new Date(asset.created_at).getTime() : Date.now()
      };

      onAssetCreated(frontendAsset);
    } catch (err) {
      console.error(err);
      alert('Generation failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  if (!activeBrand) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10">
      <div className="bg-indigo-50 p-6 rounded-full mb-6">
        <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">No Active Brand</h2>
      <p className="text-slate-500 max-w-md">Select or create a brand library from the sidebar to start generating marketing assets.</p>
    </div>
  );

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4 sm:px-0">
      {/* Instructions & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-10">
        <div className="flex-1">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Create New Asset</h2>
          <div className="p-6 bg-slate-900/5 rounded-3xl border border-slate-200/50 backdrop-blur-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">How to use</h3>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li className="flex gap-2">
                <span className="text-indigo-500 font-black">01.</span> Select a generation type based on your campaign goal.
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-black">02.</span> Provide specific details or references for the AI Creative Director.
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-black">03.</span> Review the strategy and visual, then refine using the chat feedback loop.
              </li>
            </ul>
          </div>
        </div>
        
        <div className="flex bg-white/50 backdrop-blur-md p-2 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50">
          {(['product', 'non-product'] as const).map(opt => (
            <button 
              key={opt}
              onClick={() => setOption(opt)}
              className={`px-8 py-3.5 rounded-2xl text-xs font-black transition-all capitalize whitespace-nowrap ${option === opt ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            >
              {opt.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 blur-3xl -z-10 rounded-full"></div>
        
        <div className="space-y-8">
          {option === 'product' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 space-y-4">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Reference Hero Image</label>
                <div className="aspect-square bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-400 transition-all cursor-pointer shadow-inner">
                  {productImage ? (
                    <>
                      <img src={productImage} className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setProductImage(null); }} className="absolute top-6 right-6 bg-white/95 p-3 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                         <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer text-center p-12 w-full h-full flex flex-col items-center justify-center">
                      <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl text-indigo-600 group-hover:scale-110 transition">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <span className="text-sm font-black text-slate-500">Add Product Reference</span>
                      <p className="text-xs text-slate-400 mt-2 font-medium">PNG, JPG up to 10MB</p>
                      <input type="file" className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                    </label>
                  )}
                </div>
              </div>
              <div className="lg:col-span-8 flex flex-col justify-center space-y-8">
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">What are we selling today?</label>
                  <textarea 
                    value={productFocus}
                    onChange={e => setProductFocus(e.target.value)}
                    placeholder="Describe the product context, features, or seasonal vibe..."
                    className="w-full h-52 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 transition-all text-xl font-medium leading-relaxed"
                  />
                </div>
                
                {/* Image Size Selector */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Image Size</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setImageSizePreset('story')}
                      className={`p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                        imageSizePreset === 'story' 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      Story<br/><span className="text-xs opacity-80">1080×1920</span>
                    </button>
                    <button
                      onClick={() => setImageSizePreset('square')}
                      className={`p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                        imageSizePreset === 'square' 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      Square<br/><span className="text-xs opacity-80">1080×1080</span>
                    </button>
                    <button
                      onClick={() => setImageSizePreset('custom')}
                      className={`p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                        imageSizePreset === 'custom' 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {imageSizePreset === 'custom' && (
                    <div className="flex gap-3 items-center">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Width</label>
                        <input
                          type="number"
                          min="100"
                          max="4096"
                          value={customWidth}
                          onChange={e => setCustomWidth(parseInt(e.target.value) || 1080)}
                          className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-800 font-bold"
                        />
                      </div>
                      <span className="text-2xl font-black text-slate-400 mt-6">×</span>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Height</label>
                        <input
                          type="number"
                          min="100"
                          max="4096"
                          value={customHeight}
                          onChange={e => setCustomHeight(parseInt(e.target.value) || 1080)}
                          className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-800 font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleGenerate}
                  disabled={loading || !productFocus}
                  className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? statusText : 'Draft Product Masterpiece'}
                </button>
              </div>
            </div>
          )}

          {option === 'non-product' && (
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">The Brand Moment Purpose</label>
                <textarea 
                  value={userPurpose}
                  onChange={e => setUserPurpose(e.target.value)}
                  placeholder="Hiring? Milestone? Holiday? Thought leadership?"
                  className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] h-52 font-medium text-2xl"
                />
              </div>
              <button 
                onClick={handleGenerate}
                disabled={loading || !userPurpose}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300"
              >
                {loading ? statusText : 'Generate Brand DNA Asset'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetCreationPage;


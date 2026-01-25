import React, { useState } from 'react';
import { BrandDNA, GeneratedAsset, GenerationOption } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';
import { useBrandAssets } from '../hooks/useBrandAssets.js';
import GenerationProgressBar from '../components/GenerationProgressBar.js';

interface AssetCreationPageProps {
  activeBrand: BrandDNA | null;
  onAssetCreated: (asset: GeneratedAsset) => void;
  onCancel: () => void;
}

const AssetCreationPage: React.FC<AssetCreationPageProps> = ({ activeBrand, onAssetCreated, onCancel }) => {
  const [option, setOption] = useState<GenerationOption>('product');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  // Progress tracking - now tracks steps across all items
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(1);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  const [productFocus, setProductFocus] = useState<string[]>([]);
  const [userPurpose, setUserPurpose] = useState('');
  const [productImages, setProductImages] = useState<string[]>([]);
  
  // Non-product specific state
  const [useExactLogo, setUseExactLogo] = useState(false);
  const [postCount, setPostCount] = useState(1);
  
  // Load brand assets for non-product posts
  const { assets: brandImages, logo, loading: assetsLoading } = useBrandAssets(activeBrand?.id);
  
  // Image size selector state
  const [imageSizePreset, setImageSizePreset] = useState<'story' | 'square' | 'custom'>('square');
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(1080);

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const readers = fileArray.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
      });
      
      Promise.all(readers).then((base64Images) => {
        // Add all uploaded images (no limit)
        setProductImages(prev => [...prev, ...base64Images]);
        // Initialize empty product focus for each new image
        setProductFocus(prev => [...prev, ...new Array(base64Images.length).fill('')]);
      });
    }
    // Reset input so same files can be selected again
    e.target.value = '';
  };

  const removeProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setProductFocus(prev => prev.filter((_, i) => i !== index));
  };

  const updateProductFocus = (index: number, value: string) => {
    setProductFocus(prev => {
      const newFocus = [...prev];
      newFocus[index] = value;
      return newFocus;
    });
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
    setStartTime(Date.now());
    
    try {
      if (option === 'product') {
        // Use productImages array - if empty, use empty array (will generate without reference)
        const imagesToProcess = productImages.length > 0 ? productImages : [null];
        const totalImages = imagesToProcess.length;
        
        // Each image goes through 4 steps: image generation -> text generation -> overlay design -> final output
        const stepsPerImage = 4;
        const total = totalImages * stepsPerImage;
        setTotalSteps(total);
        setCurrentStep(0);
        
        const dimensions = getImageDimensions();
        let stepCounter = 0;
        
        // Process each photo sequentially - collect previous assets for coherence
        const previousProductAssets: Array<{ productFocus: string; title?: string; subtitle?: string; visualStyle?: string }> = [];
        
        for (let i = 0; i < imagesToProcess.length; i++) {
          const photoIndex = i + 1;
          
          // Step 1: Starting image generation
          setStatusText(`Processing image ${photoIndex} of ${totalImages}...`);
          setCurrentStep(stepCounter);
          stepCounter++;
          
          // Step 2: Image generation
          setStatusText(`Generating image ${photoIndex}...`);
          setCurrentStep(stepCounter);
          stepCounter++;
          
          const generatedAsset = await assetApi.generateProduct({
            brandId: activeBrand.id,
            productFocus: productFocus[i] || '',
            referenceImageBase64: imagesToProcess[i] || undefined,
            width: dimensions.width,
            height: dimensions.height,
            previousAssets: previousProductAssets.length > 0 ? previousProductAssets : undefined
          });
          
          // Step 3: Text and overlay processing complete
          setStatusText(`Finalizing asset ${photoIndex}...`);
          setCurrentStep(stepCounter);
          stepCounter++;
          
          // Step 4: Asset complete
          setCurrentStep(stepCounter);
          stepCounter++;
          
          // Immediately convert backend format to frontend format
          const frontendAsset: GeneratedAsset = {
            ...generatedAsset,
            id: generatedAsset.id, // Ensure ID is set
            imageUrl: generatedAsset.image_url || generatedAsset.imageUrl,
            image_url: generatedAsset.image_url || generatedAsset.imageUrl, // Keep both formats
            brandId: generatedAsset.brand_id || generatedAsset.brandId,
            brand_id: generatedAsset.brand_id || generatedAsset.brandId, // Keep both formats
            campaignImages: generatedAsset.campaign_images || generatedAsset.campaignImages,
            campaign_images: generatedAsset.campaign_images || generatedAsset.campaignImages, // Keep both formats
            overlayConfig: generatedAsset.overlay_config || generatedAsset.overlayConfig,
            overlay_config: generatedAsset.overlay_config || generatedAsset.overlayConfig, // Keep both formats
            baseImageUrl: generatedAsset.base_image_url || generatedAsset.baseImageUrl,
            base_image_url: generatedAsset.base_image_url || generatedAsset.baseImageUrl, // Keep both formats
            userPrompt: generatedAsset.user_prompt || generatedAsset.userPrompt,
            user_prompt: generatedAsset.user_prompt || generatedAsset.userPrompt, // Keep both formats
            feedbackHistory: generatedAsset.feedback_history || generatedAsset.feedbackHistory,
            feedback_history: generatedAsset.feedback_history || generatedAsset.feedbackHistory, // Keep both formats
            timestamp: generatedAsset.created_at ? new Date(generatedAsset.created_at).getTime() : (generatedAsset.timestamp || Date.now())
          };
          
          // Collect asset info for sequential coherence
          const strategy = generatedAsset.strategy as any;
          previousProductAssets.push({
            productFocus: productFocus[i] || '',
            title: frontendAsset.overlayConfig?.title,
            subtitle: frontendAsset.overlayConfig?.subtitle,
            visualStyle: strategy?.step_1_image_generation?.composition_notes || strategy?.step_1_image_generation?.reasoning || ''
          });
          
          // Immediately call onAssetCreated - don't wait for batch to complete
          onAssetCreated(frontendAsset);
        }
        
        setStatusText('All photos processed!');
        setCurrentStep(total);
        
        // Reset loading state
        setLoading(false);
        setStatusText('');
        setCurrentStep(0);
        setStartTime(null);
        return;
      } else {
        // Handle batch generation for non-product posts
        // Each non-product post goes through 3 steps: strategy -> image generation -> final output
        const stepsPerPost = 3;
        const total = postCount * stepsPerPost;
        setTotalSteps(total);
        setCurrentStep(0);
        
        let stepCounter = 0;
        const assetsToCreate: GeneratedAsset[] = [];
        const previousNonProductAssets: Array<{ userPurpose: string; headline?: string; visualStyle?: string }> = [];
        
        for (let i = 0; i < postCount; i++) {
          const postNumber = i + 1;
          
          // Step 1: Strategy generation
          setStatusText(`Generating strategy for post ${postNumber} of ${postCount}...`);
          setCurrentStep(stepCounter);
          stepCounter++;
          
          // Step 2: Image generation
          setStatusText(`Generating image for post ${postNumber}...`);
          setCurrentStep(stepCounter);
          stepCounter++;
          
          const asset = await assetApi.generateNonProduct({
          brandId: activeBrand.id,
            userPurpose,
            useExactLogo,
            logoUrl: useExactLogo && logo ? logo.image_url : undefined,
            brandImageUrls: brandImages.length > 0 ? brandImages.map(img => img.image_url) : undefined,
            previousAssets: previousNonProductAssets.length > 0 ? previousNonProductAssets : undefined
          });
          
          // Step 3: Final output
          setStatusText(`Finalizing post ${postNumber}...`);
          setCurrentStep(stepCounter);
          stepCounter++;
          
          // Convert backend format to frontend format
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
          
          // Collect asset info for sequential coherence
          const strategy = asset.strategy as any;
          previousNonProductAssets.push({
            userPurpose,
            headline: frontendAsset.overlayConfig?.title,
            visualStyle: strategy?.step_1_visual_concept?.visual_metaphor_reasoning || ''
          });
          
          assetsToCreate.push(frontendAsset);
        }
        
        setStatusText('Finalizing...');
        setCurrentStep(total);
        
        // Call onAssetCreated for each generated asset
        for (const asset of assetsToCreate) {
          onAssetCreated(asset);
        }
        
        setLoading(false);
        setStatusText('');
        setCurrentStep(0);
        setStartTime(null);
        return;
      }
    } catch (err) {
      console.error(err);
      alert('Generation failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
      setStatusText('');
      setCurrentStep(0);
      setStartTime(null);
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
            <div className="space-y-8">
              {/* Reference Hero Images Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Reference Hero Images</label>
                  {productImages.length > 0 && (
                    <span className="text-xs font-bold text-slate-500">{productImages.length} photo{productImages.length !== 1 ? 's' : ''} selected</span>
                  )}
                </div>
                {productImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {productImages.map((image, index) => (
                      <div key={index} className="space-y-3">
                        <div className="aspect-square bg-slate-50 border-2 border-slate-200 rounded-2xl relative overflow-hidden group">
                          <img src={image} loading="lazy" className="w-full h-full object-cover" alt={`Product reference ${index + 1}`} />
                          <button
                            onClick={() => removeProductImage(index)}
                            className="absolute top-2 right-2 bg-white/95 p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded">
                            {index + 1}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">What are we selling today?</label>
                          <textarea 
                            value={productFocus[index] || ''}
                            onChange={e => updateProductFocus(index, e.target.value)}
                            placeholder="Describe the product context, features, or seasonal vibe..."
                            className="w-full h-32 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-50/50 focus:border-indigo-500 transition-all text-sm font-medium leading-relaxed"
                          />
                        </div>
                      </div>
                    ))}
                    <label className="aspect-square bg-slate-50 border-4 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-400 transition-all cursor-pointer shadow-inner">
                      <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-xl text-indigo-600 group-hover:scale-110 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-xs font-black text-slate-500 mt-3">Add More</span>
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleProductImageUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="block aspect-square bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-400 transition-all cursor-pointer shadow-inner max-w-md">
                    <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl text-indigo-600 group-hover:scale-110 transition">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-sm font-black text-slate-500">Add Product References</span>
                    <p className="text-xs text-slate-400 mt-2 font-medium">PNG, JPG up to 10MB</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Select multiple photos</p>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleProductImageUpload} />
                  </label>
                )}
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
              
              {/* Progress Bar */}
              {loading && startTime !== null && (
                <div key="product-progress" className="p-6 bg-indigo-50 rounded-2xl border-2 border-indigo-200">
                  <GenerationProgressBar
                    current={currentStep}
                    total={totalSteps}
                    statusText={statusText || 'Generating...'}
                    startTime={startTime}
                  />
                </div>
              )}
              
              <button 
                onClick={handleGenerate}
                disabled={loading || productImages.length === 0 || productFocus.some(focus => !focus || focus.trim() === '')}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Draft Product Masterpiece'}
              </button>
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
              
              {/* Brand Assets Section */}
              {(logo || brandImages.length > 0) && (
                <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Brand Assets</h3>
                  
                  {/* Logo */}
                  {logo && (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white rounded-xl border-2 border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                        <img src={logo.image_url} loading="lazy" alt="Brand logo" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useExactLogo}
                            onChange={e => setUseExactLogo(e.target.checked)}
                            className="w-5 h-5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-bold text-slate-700">Use exact logo in generated post</span>
                        </label>
                        <p className="text-xs text-slate-500 mt-1">The logo will be included in the generated image</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Brand Images */}
                  {brandImages.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">Brand Images ({brandImages.length} available)</p>
                      <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                        {brandImages.map((img) => (
                          <div key={img.id} className="aspect-square bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <img src={img.image_url} loading="lazy" alt="Brand image" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">All brand images will be used as reference for style and composition</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Batch Generation */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Number of Posts</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={postCount}
                    onChange={e => setPostCount(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="w-20 text-center">
                    <span className="text-2xl font-black text-slate-900">{postCount}</span>
                    <span className="text-xs text-slate-500 block">post{postCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 ml-4">Generate multiple variations (up to 10 at a time)</p>
              </div>
              
              {/* Progress Bar */}
              {loading && startTime !== null && (
                <div key="non-product-progress" className="p-6 bg-indigo-50 rounded-2xl border-2 border-indigo-200">
                  <GenerationProgressBar
                    current={currentStep}
                    total={totalSteps}
                    statusText={statusText || 'Generating...'}
                    startTime={startTime}
                  />
                </div>
              )}
              
              <button 
                onClick={handleGenerate}
                disabled={loading || !userPurpose}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Generating...' : `Generate ${postCount} Brand DNA Asset${postCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetCreationPage;


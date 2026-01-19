import React, { useState } from 'react';
import { BrandDNA, GenerationOption, GeneratedAsset } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';

interface AssetGeneratorProps {
  activeBrand: BrandDNA | null;
  onAssetCreated: (asset: GeneratedAsset) => void;
}

const AssetGenerator: React.FC<AssetGeneratorProps> = ({ activeBrand, onAssetCreated }) => {
  const [option, setOption] = useState<GenerationOption>('product');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  const [productFocus, setProductFocus] = useState('');
  const [userPurpose, setUserPurpose] = useState('');
  const [campaignDetails, setCampaignDetails] = useState('');
  const [campaignPostCount, setCampaignPostCount] = useState(3);
  const [productImage, setProductImage] = useState<string | null>(null);
  
  const [currentAsset, setCurrentAsset] = useState<GeneratedAsset | null>(null);
  const [feedback, setFeedback] = useState('');
  const [editingOverlay, setEditingOverlay] = useState(false);
  const [overlayEdit, setOverlayEdit] = useState<{
    text?: string;
    font_family?: 'sans-serif' | 'serif' | 'cursive';
    font_weight?: 'bold' | 'normal';
    font_transform?: 'uppercase' | 'none';
    text_color_hex?: string;
    position?: 'top-center' | 'bottom-left' | 'bottom-right' | 'center-middle' | 'top-left' | 'top-right' | 'center-left' | 'center-right';
    max_width_percent?: number;
  }>({});

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setProductImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!activeBrand) return;
    setLoading(true);
    setStatusText('Creative Director is mapping the vision...');
    
    try {
      let asset: GeneratedAsset;

      if (option === 'product') {
        asset = await assetApi.generateProduct({
          brandId: activeBrand.id,
          productFocus,
          referenceImageBase64: productImage || undefined
        });
        setStatusText('Capturing high-fidelity visual...');
      } else if (option === 'non-product') {
        asset = await assetApi.generateNonProduct({
          brandId: activeBrand.id,
          userPurpose
        });
        setStatusText('Visualizing abstract metaphor...');
      } else {
        asset = await assetApi.generateCampaign({
          brandId: activeBrand.id,
          campaignDetails,
          postCount: campaignPostCount
        });
        setStatusText(`Orchestrating ${campaignPostCount} post series...`);
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

      setCurrentAsset(frontendAsset);
      onAssetCreated(frontendAsset);
    } catch (err) {
      console.error(err);
      alert('Generation failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleRegenerate = async () => {
    if (!currentAsset || !feedback) return;
    setLoading(true);
    setStatusText('Refining based on feedback...');
    try {
      const updated = await assetApi.editImage(currentAsset.id, feedback);
      const frontendAsset: GeneratedAsset = {
        ...updated,
        imageUrl: updated.image_url,
        brandId: updated.brand_id,
        campaignImages: updated.campaign_images,
        overlayConfig: updated.overlay_config,
        baseImageUrl: updated.base_image_url,
        userPrompt: updated.user_prompt,
        feedbackHistory: updated.feedback_history,
        timestamp: updated.created_at ? new Date(updated.created_at).getTime() : Date.now()
      };
      setCurrentAsset(frontendAsset);
      setFeedback('');
    } catch (err) {
      alert('Revision failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOverlay = async () => {
    if (!currentAsset || currentAsset.type !== 'product') return;
    setLoading(true);
    setStatusText('Updating overlay...');
    try {
      const updated = await assetApi.updateOverlay(currentAsset.id, overlayEdit);
      const frontendAsset: GeneratedAsset = {
        ...updated,
        imageUrl: updated.image_url,
        brandId: updated.brand_id,
        campaignImages: updated.campaign_images,
        overlayConfig: updated.overlay_config,
        baseImageUrl: updated.base_image_url,
        userPrompt: updated.user_prompt,
        feedbackHistory: updated.feedback_history,
        timestamp: updated.created_at ? new Date(updated.created_at).getTime() : Date.now()
      };
      setCurrentAsset(frontendAsset);
      setEditingOverlay(false);
      setOverlayEdit({});
    } catch (err) {
      alert('Overlay update failed: ' + (err as Error).message);
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

  const displayAsset = currentAsset || null;
  const imageUrl = displayAsset?.imageUrl || displayAsset?.image_url || '';
  const campaignImages = displayAsset?.campaignImages || displayAsset?.campaign_images || [];

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4 sm:px-0">
      {/* Instructions & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-10">
        <div className="flex-1">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Content Studio</h2>
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
          {(['product', 'campaign', 'non-product'] as const).map(opt => (
            <button 
              key={opt}
              onClick={() => { setOption(opt); setCurrentAsset(null); }}
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

          {option === 'campaign' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-3 space-y-3">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Campaign Core Vision</label>
                  <textarea 
                    value={campaignDetails}
                    onChange={e => setCampaignDetails(e.target.value)}
                    placeholder="Tell the story... what's the narrative arc for this sequence?"
                    className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] h-48 font-medium text-lg"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest text-center">Posts in Series</label>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] h-48 flex flex-col items-center justify-center border-2 border-slate-100 shadow-inner">
                    <span className="text-6xl font-black text-indigo-600 mb-4">{campaignPostCount}</span>
                    <input 
                      type="range" min="2" max="5" value={campaignPostCount} 
                      onChange={e => setCampaignPostCount(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              </div>
              <button 
                onClick={handleGenerate}
                disabled={loading || !campaignDetails}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300"
              >
                {loading ? statusText : 'Initialize Campaign Sequence'}
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

      {/* Output / Results View */}
      {displayAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="lg:col-span-6 space-y-8">
            {/* Visual Preview */}
            <div className="relative group rounded-[4rem] overflow-hidden shadow-[0_48px_80px_-24px_rgba(0,0,0,0.3)] border-[20px] border-white ring-1 ring-slate-200">
              <img src={imageUrl} className="w-full aspect-square object-cover transition duration-700 group-hover:scale-105" />
              
              {/* Overlay is now baked into the image for product assets */}
              {/* For non-product assets, show CSS overlay if needed */}
              {displayAsset.type !== 'product' && (
                <div className={`absolute inset-0 flex flex-col p-16 pointer-events-none
                  ${(displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('top') ? 'justify-start' : 
                     (displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('bottom') ? 'justify-end' : 'justify-center'}
                  ${(displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('left') ? 'items-start text-left' : 
                     (displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('right') ? 'items-end text-right' : 'items-center text-center'}
                `}>
                  <h1 
                    className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] drop-shadow-2xl"
                    style={{
                      color: displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_text_color || 'white',
                      maxWidth: '90%'
                    }}
                  >
                    {displayAsset.strategy?.step_2_message_strategy?.headline_text}
                  </h1>
                  {displayAsset.strategy?.step_2_message_strategy?.body_caption_draft && (
                     <p className="mt-6 text-xl font-bold opacity-90 drop-shadow-xl text-white max-w-md">
                        {displayAsset.strategy?.step_2_message_strategy?.body_caption_draft}
                     </p>
                  )}
                </div>
              )}
            </div>

            {displayAsset.type === 'campaign' && campaignImages.length > 0 && (
              <div className="flex gap-4 overflow-x-auto py-4 custom-scrollbar px-2">
                {campaignImages.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentAsset({...displayAsset, imageUrl: img, image_url: img})}
                    className={`w-32 h-32 shrink-0 rounded-3xl overflow-hidden border-4 transition-all ${imageUrl === img ? 'border-indigo-600 scale-95 shadow-inner' : 'border-white hover:border-indigo-200'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Overlay Editing UI for Product Assets */}
            {displayAsset.type === 'product' && displayAsset.overlayConfig && (
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Text Overlay</h3>
                  <button
                    onClick={() => {
                      if (editingOverlay) {
                        setEditingOverlay(false);
                        setOverlayEdit({});
                      } else {
                        setEditingOverlay(true);
                        setOverlayEdit({
                          text: displayAsset.overlayConfig?.text,
                          font_family: displayAsset.overlayConfig?.font_family,
                          font_weight: displayAsset.overlayConfig?.font_weight,
                          font_transform: displayAsset.overlayConfig?.font_transform,
                          text_color_hex: displayAsset.overlayConfig?.text_color_hex,
                          position: displayAsset.overlayConfig?.position,
                          max_width_percent: displayAsset.overlayConfig?.max_width_percent
                        });
                      }
                    }}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-700"
                  >
                    {editingOverlay ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {!editingOverlay ? (
                  <div className="space-y-3">
                    <p className="text-lg font-bold text-slate-800">{displayAsset.overlayConfig.text}</p>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>{displayAsset.overlayConfig.font_family}</span>
                      <span>•</span>
                      <span>{displayAsset.overlayConfig.font_weight}</span>
                      <span>•</span>
                      <span>{displayAsset.overlayConfig.position}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Text</label>
                      <input
                        type="text"
                        value={overlayEdit.text || ''}
                        onChange={e => setOverlayEdit({...overlayEdit, text: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font</label>
                        <select
                          value={overlayEdit.font_family || 'sans-serif'}
                          onChange={e => setOverlayEdit({...overlayEdit, font_family: e.target.value as any})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                        >
                          <option value="sans-serif">Sans-serif</option>
                          <option value="serif">Serif</option>
                          <option value="cursive">Cursive</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Weight</label>
                        <select
                          value={overlayEdit.font_weight || 'bold'}
                          onChange={e => setOverlayEdit({...overlayEdit, font_weight: e.target.value as any})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                        >
                          <option value="bold">Bold</option>
                          <option value="normal">Normal</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={overlayEdit.text_color_hex || '#FFFFFF'}
                          onChange={e => setOverlayEdit({...overlayEdit, text_color_hex: e.target.value})}
                          className="w-16 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={overlayEdit.text_color_hex || '#FFFFFF'}
                          onChange={e => setOverlayEdit({...overlayEdit, text_color_hex: e.target.value})}
                          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Position</label>
                      <select
                        value={overlayEdit.position || 'bottom-center'}
                        onChange={e => setOverlayEdit({...overlayEdit, position: e.target.value as any})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-right">Top Right</option>
                        <option value="center-left">Center Left</option>
                        <option value="center-middle">Center Middle</option>
                        <option value="center-right">Center Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                        Max Width: {overlayEdit.max_width_percent || 80}%
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        value={overlayEdit.max_width_percent || 80}
                        onChange={e => setOverlayEdit({...overlayEdit, max_width_percent: parseInt(e.target.value)})}
                        className="w-full"
                      />
                    </div>

                    <button
                      onClick={handleUpdateOverlay}
                      disabled={loading}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Apply Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Strategy & Feedback Chat */}
          <div className="lg:col-span-6 flex flex-col gap-8">
            <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm flex-1">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic">CD</div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Director's Rationale</h3>
              </div>
              <div className="space-y-8">
                <p className="text-slate-700 italic leading-relaxed text-2xl font-semibold">
                  "{displayAsset.strategy?.step_1_image_generation?.reasoning || 
                    displayAsset.strategy?.step_1_visual_strategy?.reasoning || 
                    displayAsset.strategy?.step_1_visual_concept?.visual_metaphor_reasoning || 
                    "Campaign coordinated sequence focusing on multi-touch narrative."}"
                </p>
                {displayAsset.type === 'product' && displayAsset.strategy?.step_2_tagline && (
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Tagline</p>
                    <p className="text-lg font-black text-indigo-900">{displayAsset.strategy.step_2_tagline.tagline}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visual Tone</p>
                    <p className="text-sm font-black text-slate-800">{activeBrand.visual_identity.font_vibe}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Composition</p>
                    <p className="text-sm font-black text-slate-800">{displayAsset.strategy?.step_1_image_generation?.composition_notes || displayAsset.strategy?.step_1_visual_strategy?.composition_notes || 'Metaphorical'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Box for Feedback */}
            <div className="bg-slate-950 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col gap-6">
              <div className="relative z-10">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6">Feedback Loop</h3>
                
                {/* Message list simulation */}
                <div className="max-h-40 overflow-y-auto mb-6 space-y-4 custom-scrollbar pr-4">
                  <div className="flex justify-start">
                    <div className="bg-white/10 p-4 rounded-2xl rounded-tl-none text-sm font-medium border border-white/10 max-w-[80%]">
                      Ready to polish this asset. Any adjustments needed?
                    </div>
                  </div>
                  {(displayAsset.feedbackHistory || displayAsset.feedback_history || []).map((f, i) => (
                    <div key={i} className="flex justify-end">
                      <div className="bg-indigo-600 p-4 rounded-2xl rounded-tr-none text-sm font-black max-w-[80%]">
                        {f}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <input 
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="e.g. 'Make it darker', 'Move the focus'..."
                    className="flex-1 bg-white/10 border-2 border-white/20 rounded-[1.5rem] px-8 py-5 outline-none focus:bg-white/20 focus:border-indigo-400 transition-all font-bold placeholder:text-white/30"
                    onKeyDown={e => e.key === 'Enter' && handleRegenerate()}
                  />
                  <button 
                    onClick={handleRegenerate}
                    disabled={loading || !feedback}
                    className="bg-white text-slate-900 px-10 py-5 rounded-[1.5rem] font-black hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="absolute -left-20 -top-20 w-80 h-80 bg-indigo-600/10 blur-[100px] rounded-full"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetGenerator;


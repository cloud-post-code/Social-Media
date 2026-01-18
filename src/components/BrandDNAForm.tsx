import React, { useState, useEffect } from 'react';
import { BrandDNA } from '../models/types.js';
import { brandApi } from '../services/brandApi.js';

interface BrandDNAFormProps {
  dna: Partial<BrandDNA>;
  onSave: (dna: BrandDNA) => void;
  onCancel: () => void;
}

const BrandDNAForm: React.FC<BrandDNAFormProps> = ({ dna, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<BrandDNA>>(dna);
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  // Sync state if prop changes
  useEffect(() => {
    setFormData(dna);
  }, [dna]);

  const handleExtract = async () => {
    if (!urlInput) return;
    setIsExtracting(true);
    try {
      const extracted = await brandApi.extractDNA({ url: urlInput });
      setFormData(extracted);
    } catch (err) {
      alert('Extraction failed. Please ensure the URL is valid.');
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
        const extracted = await brandApi.extractDNA({ imageBase64: base64 });
        setFormData(extracted);
      } catch (err) {
        alert('Failed to analyze screenshot.');
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
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

  const handleSubmit = (e: React.FormEvent) => {
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
      },
      image_generation_prompt_prefix: formData.image_generation_prompt_prefix || ''
    };
    onSave(finalData);
  };

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
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Primary Color</label>
                      <div className="flex gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                          <input type="color" className="absolute inset-0 w-[200%] h-[200%] cursor-pointer -translate-x-1/4 -translate-y-1/4" value={formData.visual_identity?.primary_color_hex || '#4F46E5'} onChange={e => updateNested('visual_identity.primary_color_hex', e.target.value)} />
                        </div>
                        <input value={formData.visual_identity?.primary_color_hex || ''} onChange={e => updateNested('visual_identity.primary_color_hex', e.target.value)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono" />
                      </div>
                   </div>
                   <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Accent Color</label>
                      <div className="flex gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                          <input type="color" className="absolute inset-0 w-[200%] h-[200%] cursor-pointer -translate-x-1/4 -translate-y-1/4" value={formData.visual_identity?.accent_color_hex || '#F59E0B'} onChange={e => updateNested('visual_identity.accent_color_hex', e.target.value)} />
                        </div>
                        <input value={formData.visual_identity?.accent_color_hex || ''} onChange={e => updateNested('visual_identity.accent_color_hex', e.target.value)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono" />
                      </div>
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

            <section>
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Creative Engine</h3>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Imagen Prompt Prefix</label>
                <textarea rows={5} value={formData.image_generation_prompt_prefix || ''} onChange={e => setFormData({...formData, image_generation_prompt_prefix: e.target.value})} className="w-full p-4 bg-slate-900 text-indigo-300 border border-slate-800 rounded-2xl text-xs font-mono leading-relaxed" placeholder="A high-quality professional photo in the style of [Brand]..." />
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BrandDNAForm;


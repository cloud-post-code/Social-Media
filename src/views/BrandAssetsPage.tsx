import React, { useState } from 'react';
import { BrandDNA } from '../models/types.js';
import { brandApi } from '../services/brandApi.js';
import { useBrands } from '../hooks/useBrands.js';

interface BrandAssetsPageProps {
  activeBrand: BrandDNA | null;
  onBack: () => void;
}

const BrandAssetsPage: React.FC<BrandAssetsPageProps> = ({ activeBrand, onBack }) => {
  const { updateBrand } = useBrands();
  const [uploading, setUploading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  if (!activeBrand) {
    return (
      <div className="p-10">
        <p className="text-slate-500">No brand selected</p>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentImages = activeBrand.brand_images || [];
    if (currentImages.length >= 10) {
      alert('Maximum of 10 brand images allowed');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const updated = await brandApi.uploadImage(activeBrand.id, base64);
        await updateBrand(activeBrand.id, updated);
      } catch (err) {
        alert('Failed to upload image.');
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (index: number) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    setDeletingIndex(index);
    try {
      const updated = await brandApi.deleteImage(activeBrand.id, index);
      await updateBrand(activeBrand.id, updated);
    } catch (err) {
      alert('Failed to delete image.');
      console.error(err);
    } finally {
      setDeletingIndex(null);
    }
  };

  const brandImages = activeBrand.brand_images || [];
  const hasLogo = !!activeBrand.logo_url;
  const canUploadMore = brandImages.length < 10;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Header */}
      <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Brand Assets</h2>
            <p className="text-slate-500 font-medium">{activeBrand.name}</p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 text-slate-600 font-bold hover:text-slate-900 transition"
          >
            ← Back
          </button>
        </div>
      </section>

      {/* Logo Section */}
      <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 mb-6">Logo</h3>
        {hasLogo ? (
          <div className="relative inline-block">
            <div className="bg-slate-50 p-8 rounded-2xl border-2 border-dashed border-slate-200 inline-block">
              <img
                src={activeBrand.logo_url}
                alt={`${activeBrand.name} logo`}
                className="max-w-xs max-h-32 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = 
                    '<div class="text-slate-400 text-sm">Failed to load logo</div>';
                }}
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-medium">No logo extracted</p>
          </div>
        )}
      </section>

      {/* Brand Images Section */}
      <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900">Brand Images</h3>
            <p className="text-sm text-slate-500 mt-1">
              {brandImages.length} / 10 images
            </p>
          </div>
          {canUploadMore && (
            <label className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition active:scale-95">
              {uploading ? 'Uploading...' : '+ Upload Image'}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {brandImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {brandImages.map((imageUrl, index) => (
              <div
                key={index}
                className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-sm"
              >
                <img
                  src={imageUrl}
                  alt={`Brand image ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = 
                      '<div class="flex items-center justify-center h-full text-slate-400 text-sm">Failed to load</div>';
                  }}
                />
                {/* Delete button overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleDeleteImage(index)}
                    disabled={deletingIndex === index}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deletingIndex === index ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-medium mb-4">No brand images yet</p>
            {canUploadMore && (
              <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition active:scale-95">
                + Upload First Image
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        )}

        {!canUploadMore && brandImages.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              Maximum of 10 images reached. Delete an image to upload a new one.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default BrandAssetsPage;


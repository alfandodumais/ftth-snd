import React, { useState } from 'react';
import { X, Save, Settings2, MapPin, Cable } from 'lucide-react';
import { apiFetch } from '../api';

export default function ProjectEditorModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    clusterCode: project.clusterCode || '',
    clusterName: project.clusterName || '',
    region: project.region || '',
    province: project.province || '',
    regencyCity: project.regencyCity || '',
    district: project.district || '',
    subdistrict: project.subdistrict || '',
    postalCode: project.postalCode || '',
    fatAddress: project.fatAddress || '',
    addressPrefix: project.addressPrefix || 'JLN.',
    street: project.street || '',
    oltName: project.oltName || '',
    feederCode: project.feederCode || '',
    fdts: (project.fdts || []).map((f) => ({
      id: f.id,
      sheetName: f.sheetName,
      fdtId: f.fdtId,
      fdtCapacity: f.fdtCapacity,
      oltCode: f.oltCode,
      oltName: f.oltName,
      routeLineA48: f.routeLineA48 || 0,
      routeLineB48: f.routeLineB48 || 0,
      routeLineC48: f.routeLineC48 || 0,
      slingWireRouteM: f.slingWireRouteM || 0,
      newPole7m25: f.newPole7m25 || 0,
      newPole7m3: f.newPole7m3 || 0,
      newPole7m4: f.newPole7m4 || 0,
      newPole9m4: f.newPole9m4 || 0,
      extPoleMr: f.extPoleMr || 0,
      fats: (f.fats || []).map((fat) => ({
        id: fat.id,
        fatCode: fat.fatCode,
        lineName: fat.lineName,
        poleId: fat.poleId,
        hpCount: fat.hpCount ?? (fat.homepasses ? fat.homepasses.length : 0),
        fatAddress: fat.fatAddress || project.fatAddress || ''
      }))
    }))
  });

  const [bulkFatAddress, setBulkFatAddress] = useState(project.fatAddress || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFdtChange = (idx, field, val) => {
    setForm((prev) => {
      const nextFdts = [...prev.fdts];
      nextFdts[idx] = { ...nextFdts[idx], [field]: val };
      return { ...prev, fdts: nextFdts };
    });
  };

  const handleFatAddressChange = (fdtIdx, fatIdx, val) => {
    setForm((prev) => {
      const nextFdts = [...prev.fdts];
      const nextFats = [...(nextFdts[fdtIdx].fats || [])];
      nextFats[fatIdx] = { ...nextFats[fatIdx], fatAddress: val };
      nextFdts[fdtIdx] = { ...nextFdts[fdtIdx], fats: nextFats };
      return { ...prev, fdts: nextFdts };
    });
  };

  const handleApplyBulkFatAddress = () => {
    if (!bulkFatAddress.trim()) return;
    const trimmed = bulkFatAddress.trim();
    const spaceIdx = trimmed.indexOf(' ');
    const derivedStreet = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1).trim() : trimmed;
    setForm((prev) => ({
      ...prev,
      fatAddress: trimmed,
      street: derivedStreet,
      fdts: prev.fdts.map((fdt) => ({
        ...fdt,
        fats: (fdt.fats || []).map((fat) => ({
          ...fat,
          fatAddress: trimmed
        }))
      }))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      onSaved(res.project);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Settings2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Konfigurasi Parameter Administratif &amp; Kuantitas BoM Cluster
              </h3>
              <p className="text-xs text-slate-400">
                Perubahan otomatis tersinkron ke seluruh sel Excel HPDB &amp; BoQ saat diekspor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Administrative Fields for HPDB */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
              <MapPin className="w-4 h-4" />
              <span>1. Parameter Wilayah &amp; Alamat Standar HPDB</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Cluster Code</label>
                <input
                  type="text"
                  value={form.clusterCode}
                  onChange={(e) => setForm({ ...form, clusterCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Cluster Name (Kolom Y &amp; Z)</label>
                <input
                  type="text"
                  value={form.clusterName}
                  onChange={(e) => setForm({ ...form, clusterName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Area / Region (Kolom W)</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Province (Kolom M)</label>
                <input
                  type="text"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Regency / City (Kolom N)</label>
                <input
                  type="text"
                  value={form.regencyCity}
                  onChange={(e) => setForm({ ...form, regencyCity: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">District / Kecamatan (Kolom O)</label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Subdistrict / Kelurahan (Kolom P)</label>
                <input
                  type="text"
                  value={form.subdistrict}
                  onChange={(e) => setForm({ ...form, subdistrict: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Postal Code (Kolom Q)</label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Street Name Default (Kolom AD)</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">OLT Name</label>
                <input
                  type="text"
                  value={form.oltName}
                  onChange={(e) => setForm({ ...form, oltName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">OLT / Feeder Code (Kolom AR)</label>
                <input
                  type="text"
                  value={form.feederCode}
                  onChange={(e) => setForm({ ...form, feederCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            {/* Custom FAT Address per FAT (Kolom L) */}
            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                    <span>FAT Address Custom per FAT (Kolom L)</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] text-cyan-300">
                      Otomatis Sinkron Street (Kolom AD)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Atur alamat jalan (Kolom L) secara spesifik untuk masing-masing FAT (contoh: <code className="text-slate-300">Jl. Imam Bonjol</code>)
                  </p>
                </div>

                {/* Quick Bulk Apply */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={bulkFatAddress}
                    onChange={(e) => setBulkFatAddress(e.target.value)}
                    placeholder="Isi cepat semua FAT..."
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs w-44 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBulkFatAddress}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold whitespace-nowrap transition"
                  >
                    Terapkan Semua
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {form.fdts.map((fdt, fdtIdx) => (
                  <div key={fdt.id || fdtIdx} className="space-y-2">
                    {form.fdts.length > 1 && (
                      <div className="text-[11px] font-bold text-slate-300">
                        {fdt.sheetName} — {fdt.fdtId}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {(fdt.fats || []).map((fat, fatIdx) => {
                        const addrVal = fat.fatAddress || '';
                        const spIdx = addrVal.indexOf(' ');
                        const derivedStreet = spIdx >= 0 ? addrVal.slice(spIdx + 1).trim() : (addrVal || form.street);
                        return (
                          <div
                            key={fat.id || `${fdtIdx}-${fat.fatCode}`}
                            className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-extrabold text-emerald-400 font-mono">
                                FAT {fat.fatCode}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {fat.lineName} • {fat.hpCount} HP
                              </span>
                            </div>
                            <input
                              type="text"
                              value={addrVal}
                              onChange={(e) => handleFatAddressChange(fdtIdx, fatIdx, e.target.value)}
                              placeholder="Contoh: Jl. Imam Bonjol"
                              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:outline-none text-white text-xs"
                            />
                            <div className="text-[10px] text-slate-500 truncate">
                              Street (AD): <span className="text-slate-300 font-medium">{derivedStreet || '-'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FDT BoM Quantities */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
              <Cable className="w-4 h-4" />
              <span>2. Kuantitas BoM AE per FDT (Route FO 48C, Sling Wire &amp; Tiang)</span>
            </div>
            <div className="space-y-3">
              {form.fdts.map((fdt, idx) => (
                <div
                  key={fdt.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">
                      {fdt.sheetName} — FDT ID: {fdt.fdtId} ({fdt.fdtCapacity})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Route Line A 48C (m)</label>
                      <input
                        type="number"
                        value={fdt.routeLineA48}
                        onChange={(e) => handleFdtChange(idx, 'routeLineA48', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Route Line B 48C (m)</label>
                      <input
                        type="number"
                        value={fdt.routeLineB48}
                        onChange={(e) => handleFdtChange(idx, 'routeLineB48', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Route Line C 48C (m)</label>
                      <input
                        type="number"
                        value={fdt.routeLineC48}
                        onChange={(e) => handleFdtChange(idx, 'routeLineC48', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Sling Wire Route (m)</label>
                      <input
                        type="number"
                        value={fdt.slingWireRouteM}
                        onChange={(e) => handleFdtChange(idx, 'slingWireRouteM', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">New Pole 7m - 2.5&quot;</label>
                      <input
                        type="number"
                        value={fdt.newPole7m25}
                        onChange={(e) => handleFdtChange(idx, 'newPole7m25', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">New Pole 7m - 3&quot;</label>
                      <input
                        type="number"
                        value={fdt.newPole7m3}
                        onChange={(e) => handleFdtChange(idx, 'newPole7m3', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">New Pole 7m - 4&quot;</label>
                      <input
                        type="number"
                        value={fdt.newPole7m4}
                        onChange={(e) => handleFdtChange(idx, 'newPole7m4', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">New Pole 9m - 4&quot;</label>
                      <input
                        type="number"
                        value={fdt.newPole9m4}
                        onChange={(e) => handleFdtChange(idx, 'newPole9m4', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Existing Pole EMR</label>
                      <input
                        type="number"
                        value={fdt.extPoleMr}
                        onChange={(e) => handleFdtChange(idx, 'extPoleMr', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan & Sinkronkan Excel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

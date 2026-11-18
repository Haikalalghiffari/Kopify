"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { ImportStepIndicator } from "./ImportStepIndicator";
import { FormField, Input } from "@/components/shared/FormField";
import { useToast } from "@/components/shared/Toast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ColumnMapping, DuplicateHandlingMode, ImportDataType } from "@/lib/import/types";
import { isImportExecutionLocked } from "@/lib/import/executeGuard";
import { fieldsForImportType } from "@/lib/import/fields";
import type {
  ParseImportApiResponse,
  PreviewImportApiResponse,
} from "@/lib/import/sessionPayload";
import { cn } from "@/lib/utils";

interface ExecuteImportResponse {
  success: true;
  importLogId: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
}

export function ImportWizard() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState<ImportDataType>("MEMBERS");
  const [file, setFile] = useState<File | null>(null);
  const [worksheetName, setWorksheetName] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseImportApiResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewImportApiResponse | null>(null);
  const [strict, setStrict] = useState(false);
  const [duplicateMode, setDuplicateMode] =
    useState<DuplicateHandlingMode>("SKIP");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteImportResponse | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<
    { id: string; name: string; mappingJson: ColumnMapping }[]
  >([]);

  const [fileInputKey, setFileInputKey] = useState(0);
  const executingRef = useRef(false);
  const executionLocked = isImportExecutionLocked(executeResult);

  const fieldDefs = useMemo(() => fieldsForImportType(importType), [importType]);

  const resetFromUpload = useCallback(() => {
    setParseResult(null);
    setMapping({});
    setPreview(null);
    setWorksheetName("");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    resetFromUpload();
    setExecuteResult(null);
    setFieldError(null);
  };

  const startNewImport = () => {
    if (executingRef.current) return;
    setFile(null);
    resetFromUpload();
    setExecuteResult(null);
    setFieldError(null);
    setTemplateName("");
    setFileInputKey((k) => k + 1);
    setStep(1);
  };

  const runParse = async () => {
    if (!file) {
      setFieldError("Pilih file .xlsx, .xls, atau .csv terlebih dahulu.");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const fd = new FormData();
      fd.append("importType", importType);
      fd.append("file", file);
      if (worksheetName) fd.append("worksheetName", worksheetName);

      const res = await fetch("/api/admin/import/parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Gagal membaca file.");
      }
      const parsed = data as ParseImportApiResponse;
      setParseResult(parsed);
      setMapping(parsed.suggestedMapping);
      setWorksheetName(parsed.selectedWorksheet);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membaca file.";
      setFieldError(msg);
      toastError("Gagal memproses file", msg);
    } finally {
      setBusy(false);
    }
  };

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/import/templates?type=${importType}`);
      const json = await res.json();
      if (json.success) {
        setSavedTemplates(json.data);
      }
    } catch {
      /* abaikan */
    }
  }, [importType]);

  React.useEffect(() => {
    if (step === 2) {
      loadTemplates();
    }
  }, [step, loadTemplates]);

  const saveMappingTemplate = async () => {
    if (!templateName.trim()) {
      setFieldError("Isi nama template pemetaan terlebih dahulu.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: importType,
          name: templateName.trim(),
          mapping,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Gagal menyimpan template.");
      }
      setTemplateName("");
      await loadTemplates();
      toastSuccess("Template disimpan", "Pemetaan dapat dipakai ulang pada impor berikutnya.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan template.";
      toastError("Simpan template gagal", msg);
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = (tpl: { mappingJson: ColumnMapping }) => {
    setMapping(tpl.mappingJson);
  };

  const runExecute = async () => {
    if (!file || executingRef.current || executionLocked) return;
    executingRef.current = true;
    setBusy(true);
    setFieldError(null);
    setExecuteResult(null);
    try {
      const fd = new FormData();
      fd.append("importType", importType);
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("worksheetName", worksheetName);
      fd.append("strict", strict ? "true" : "false");
      fd.append("duplicateMode", duplicateMode);

      const res = await fetch("/api/admin/import/execute", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Impor gagal.");
      }
      setExecuteResult(data as ExecuteImportResponse);
      window.dispatchEvent(new CustomEvent("kopify-import-complete"));
      toastSuccess(
        "Impor selesai",
        `Berhasil ${data.successRows}, gagal ${data.failedRows}, dilewati ${data.skippedRows}.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impor gagal.";
      setFieldError(msg);
      toastError("Impor gagal", msg);
    } finally {
      executingRef.current = false;
      setBusy(false);
    }
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    setFieldError(null);
    try {
      const fd = new FormData();
      fd.append("importType", importType);
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("worksheetName", worksheetName);
      fd.append("strict", strict ? "true" : "false");

      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Gagal membuat pratinjau.");
      }
      setPreview(data as PreviewImportApiResponse);
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat pratinjau.";
      setFieldError(msg);
      toastError("Pratinjau gagal", msg);
    } finally {
      setBusy(false);
    }
  };

  const updateMapping = (sourceHeader: string, target: string) => {
    setMapping((prev) => ({
      ...prev,
      [sourceHeader]: target === "" ? null : target,
    }));
  };

  const templateHref =
    importType === "MEMBERS"
      ? "/api/admin/import/templates/MEMBERS"
      : "/api/admin/import/templates/PRODUCTS";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900">Impor Data Excel</h1>
        <p className="text-sm text-slate-600">
          Unggah data anggota atau barang dari sistem lama. Data disimpan ke database pada
          langkah konfirmasi. Stok awal barang baru dicatat lewat stockService (IMPORT).
        </p>
      </header>

      <ImportStepIndicator currentStep={step} />

      {step === 1 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm">
          <FormField label="Jenis data" required>
            <div className="flex flex-col sm:flex-row gap-3">
              {(["MEMBERS", "PRODUCTS"] as ImportDataType[]).map((type) => (
                <label
                  key={type}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer text-sm",
                    importType === type
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <input
                    type="radio"
                    name="importType"
                    className="text-emerald-600 focus:ring-emerald-500"
                    checked={importType === type}
                    onChange={() => {
                      setImportType(type);
                      resetFromUpload();
                    }}
                  />
                  <span>{type === "MEMBERS" ? "Anggota" : "Barang"}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-slate-600 flex-1">
              Unduh template kolom standar sebelum mengisi data di Excel.
            </p>
            <a
              href={templateHref}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg min-h-[44px]"
            >
              <Download className="w-4 h-4" aria-hidden />
              Unduh template
            </a>
          </div>

          <FormField
            label="File impor"
            required
            error={fieldError ?? undefined}
            hint="Maksimal 10 MB. Format: .xlsx, .xls, .csv"
          >
            <Input
              key={fileInputKey}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-emerald-50 file:text-emerald-800 file:text-sm"
            />
            {file && (
              <p className="text-xs text-slate-500 mt-1">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </FormField>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy || !file}
              onClick={runParse}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Lanjut ke pemetaan
            </button>
          </div>
        </section>
      )}

      {step === 2 && parseResult && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
          <p className="text-sm text-slate-600">
            File <strong className="text-slate-800">{parseResult.filename}</strong>, worksheet{" "}
            <strong className="text-slate-800">{parseResult.selectedWorksheet}</strong>,{" "}
            {parseResult.totalDataRows} baris data.
          </p>

          {parseResult.worksheets.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <FormField label="Pilih worksheet" className="flex-1">
                <select
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={worksheetName || parseResult.selectedWorksheet}
                  onChange={(e) => setWorksheetName(e.target.value)}
                >
                  {parseResult.worksheets.map((ws) => (
                    <option key={ws.name} value={ws.name}>
                      {ws.name} ({ws.rowCount} baris)
                    </option>
                  ))}
                </select>
              </FormField>
              <button
                type="button"
                disabled={busy}
                onClick={runParse}
                className="px-4 py-2 text-sm font-medium text-emerald-800 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 min-h-[44px]"
              >
                Muat worksheet
              </button>
            </div>
          )}

          {savedTemplates.length > 0 && (
            <p className="text-sm text-slate-600">
              Template tersimpan:{" "}
              {savedTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="mr-2 text-emerald-700 hover:underline font-medium"
                >
                  {tpl.name}
                </button>
              ))}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <FormField label="Simpan pemetaan sebagai template" className="flex-1">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Contoh: Format Excel lama koperasi"
              />
            </FormField>
            <button
              type="button"
              disabled={busy}
              onClick={saveMappingTemplate}
              className="px-4 py-2 text-sm font-medium text-emerald-800 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 min-h-[44px]"
            >
              Simpan template
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kolom file</th>
                  <th className="px-4 py-3 font-semibold">Kolom sistem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parseResult.headers.map((header) => (
                  <tr key={header}>
                    <td className="px-4 py-3 text-slate-800">{header}</td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full min-w-[12rem] px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        value={mapping[header] ?? ""}
                        onChange={(e) => updateMapping(header, e.target.value)}
                      >
                        <option value="">— Abaikan —</option>
                        {fieldDefs.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fieldError && (
            <p className="text-sm text-rose-600 font-medium" role="alert">
              {fieldError}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[44px]"
            >
              Kembali
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={runPreview}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Lanjut ke pratinjau
            </button>
          </div>
        </section>
      )}

      {step === 3 && preview && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
          {!preview.mappingValid && (
            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-900">
              <p className="font-medium mb-1">Pemetaan kolom belum lengkap</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {preview.mappingErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Total baris", value: preview.totalRows },
              { label: "Valid", value: preview.validCount },
              { label: "Bermasalah", value: preview.invalidCount },
            ].map((item) => (
              <div key={item.label} className="p-4 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <FormField label="Mode duplikat (saat eksekusi nanti)">
              <select
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                value={duplicateMode}
                onChange={(e) =>
                  setDuplicateMode(e.target.value as DuplicateHandlingMode)
                }
              >
                <option value="SKIP">Lewati data yang sudah ada</option>
                <option value="UPDATE">Perbarui data yang sudah ada</option>
                <option value="ERROR">Tandai duplikat sebagai error</option>
              </select>
            </FormField>
            <label className="flex items-start gap-2 text-sm text-slate-700 pt-8 cursor-pointer">
              <input
                type="checkbox"
                checked={strict}
                onChange={(e) => setStrict(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Mode ketat (peringatan dianggap error, misalnya harga jual &lt; beli)</span>
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Menampilkan 20 baris pertama. Belum ada data yang ditulis ke database pada tahap
            pratinjau.
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Baris</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.previewRows.map((row) => (
                  <tr key={row.sourceRowNumber}>
                    <td className="px-3 py-2 text-slate-700">{row.sourceRowNumber}</td>
                    <td className="px-3 py-2">
                      {row.valid ? (
                        <StatusBadge status="SELESAI" variant="success" className="text-[10px]" />
                      ) : (
                        <StatusBadge status="DITOLAK" variant="danger" className="text-[10px]" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.errors.length > 0
                        ? row.errors.map((e) => e.message).join("; ")
                        : row.warnings.length > 0
                        ? row.warnings.map((w) => w.message).join("; ")
                        : "Siap diproses"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[44px]"
            >
              Ubah pemetaan
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!preview.mappingValid || preview.validCount === 0}
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              Lanjut ke konfirmasi
            </button>
          </div>
        </section>
      )}

      {step === 4 && preview && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Ringkasan sebelum eksekusi</h2>
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            <li>
              Jenis: <strong>{importType === "MEMBERS" ? "Anggota" : "Barang"}</strong>
            </li>
            <li>
              File: <strong>{parseResult?.filename}</strong>
            </li>
            <li>
              Baris valid: <strong>{preview.validCount}</strong> dari {preview.totalRows}
            </li>
            <li>
              Mode duplikat: <strong>{duplicateMode}</strong>
            </li>
          </ul>
          {importType === "PRODUCTS" && (
            <p className="text-sm text-slate-700 border border-slate-200 bg-slate-50 rounded-lg p-4">
              Barang baru: stok awal dari file dicatat sebagai pergerakan IMPORT. Barang yang sudah
              ada tidak diubah stoknya pada mode UPDATE; kolom stok awal ditolak jika diisi.
            </p>
          )}

          {executeResult && (
            <div
              role="status"
              className={cn(
                "p-4 border rounded-lg text-sm space-y-2",
                executeResult.status === "SUCCESS"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              <p className="font-semibold">Hasil impor dari database</p>
              <p>
                Status: {executeResult.status}. Berhasil {executeResult.successRows}, gagal{" "}
                {executeResult.failedRows}, dilewati {executeResult.skippedRows} dari{" "}
                {executeResult.totalRows} baris.
              </p>
              {executeResult.failedRows > 0 && (
                <a
                  href={`/api/admin/import/history/${executeResult.importLogId}/errors`}
                  className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                >
                  Unduh laporan error Excel
                </a>
              )}
              {executionLocked && (
                <p className="text-xs">
                  Impor ini sudah dijalankan. Untuk mengimpor file lain, pilih Mulai impor baru.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            {executionLocked ? (
              <button
                type="button"
                onClick={startNewImport}
                className="px-4 py-2.5 text-sm font-medium text-emerald-800 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 min-h-[44px]"
              >
                Mulai impor baru
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep(3)}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
              >
                Kembali ke pratinjau
              </button>
            )}
            <button
              type="button"
              disabled={
                busy ||
                executionLocked ||
                !preview.mappingValid ||
                preview.validCount === 0
              }
              onClick={runExecute}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              {busy
                ? "Mengimpor..."
                : executionLocked
                ? "Impor sudah dijalankan"
                : "Jalankan impor ke database"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
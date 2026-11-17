"use client";

import { useState, useEffect, useTransition } from "react";
import {
  uploadAndAnalyzeFile,
  validateRowsAction,
  executeImportAction,
  getImportHistory,
  saveImportTemplate,
  getSavedTemplates,
} from "@/actions/import";
import { IMPORT_SCHEMA_DEFINITIONS, DuplicateMode } from "@/services/importService";
import { formatDateTime } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  FileUp,
  Download,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Save,
  RotateCcw,
  Loader2,
  Layers,
} from "lucide-react";

export default function ImportWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [importType, setImportType] = useState<"ANGGOTA" | "BARANG">("BARANG");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  // Analysis Result (Step 1 -> 2)
  const [analysisData, setAnalysisData] = useState<{
    filename: string;
    headers: string[];
    totalRows: number;
    sampleRows: any[];
    allRows: any[];
    suggestedMappings: Record<string, string>;
  } | null>(null);

  // Column Mappings (Step 2)
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);

  // Validation Result (Step 3)
  const [validationSummary, setValidationSummary] = useState<any>(null);

  // Execution Options & Result (Step 4)
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("SKIP");
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Import History Logs
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  const loadHistory = async () => {
    try {
      const logs = await getImportHistory();
      setHistoryLogs(logs);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    getSavedTemplates(importType).then(setSavedTemplates).catch(() => {});
  }, [importType]);

  // Step 1: Upload and Analyze
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Silakan pilih file Excel / CSV terlebih dahulu");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", importType);

        const result = await uploadAndAnalyzeFile(formData);
        setAnalysisData(result);
        setMappings(result.suggestedMappings);
        setCurrentStep(2);
        toast.success(`File berhasil dibaca: ${result.totalRows} baris ditemukan`);
      } catch (err: any) {
        toast.error(err.message || "Gagal membaca file");
      }
    });
  };

  // Step 2: Validate Mappings
  const handleProceedToValidation = async () => {
    if (!analysisData) return;

    // Check if required fields mapped
    const requiredDefs = IMPORT_SCHEMA_DEFINITIONS[importType].filter((d) => d.required);
    const mappedSystemFields = Object.values(mappings);

    for (const req of requiredDefs) {
      if (!mappedSystemFields.includes(req.field)) {
        toast.error(`Kolom wajib '${req.label}' belum dipetakan!`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const valRes = await validateRowsAction({
          rows: analysisData.allRows,
          mappings,
          type: importType,
        });
        setValidationSummary(valRes);
        setCurrentStep(3);
      } catch (err: any) {
        toast.error(err.message || "Gagal memvalidasi data");
      }
    });
  };

  // Step 4: Execute Import
  const handleExecuteImport = async () => {
    if (!analysisData) return;

    startTransition(async () => {
      try {
        const result = await executeImportAction({
          rows: analysisData.allRows,
          mappings,
          type: importType,
          duplicateMode,
          filename: analysisData.filename,
        });
        setExecutionResult(result);
        setCurrentStep(4);
        loadHistory();
        toast.success(`Impor selesai: ${result.success} berhasil, ${result.skipped} dilewati, ${result.failed} gagal`);
      } catch (err: any) {
        toast.error(err.message || "Terjadi kesalahan saat mengeksekusi impor");
      }
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Beri nama template terlebih dahulu");
      return;
    }
    try {
      await saveImportTemplate({
        name: templateName.trim(),
        type: importType,
        mapping: mappings,
      });
      toast.success("Template pemetaan kolom berhasil disimpan!");
      setTemplateName("");
      const updated = await getSavedTemplates(importType);
      setSavedTemplates(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setFile(null);
    setAnalysisData(null);
    setMappings({});
    setValidationSummary(null);
    setExecutionResult(null);
  };

  const schemaFields = IMPORT_SCHEMA_DEFINITIONS[importType];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Wizard Impor Data Excel
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Konversi dan migrasi cepat data Anggota & Barang dari spreadsheet lama ke sistem Kopify
          </p>
        </div>

        {/* Download Template Buttons */}
        <div className="flex gap-2">
          <a
            href="/api/import/template?type=ANGGOTA"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Template Anggota (.xlsx)
          </a>
          <a
            href="/api/import/template?type=BARANG"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Template Barang (.xlsx)
          </a>
        </div>
      </div>

      {/* 4-Step Indicator Bar */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
        {[
          { num: 1, label: "Unggah File" },
          { num: 2, label: "Pemetaan Kolom" },
          { num: 3, label: "Pratinjau & Validasi" },
          { num: 4, label: "Eksekusi & Hasil" },
        ].map((s) => {
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;
          return (
            <div
              key={s.num}
              className={`p-3 rounded-2xl border transition-all ${
                isCurrent
                  ? "bg-[#0B3B2C] text-white border-[#0B3B2C] shadow-md"
                  : isDone
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-white text-gray-400 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    isCurrent
                      ? "bg-[#B6F53B] text-[#0B3B2C]"
                      : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isDone ? "✓" : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: UPLOAD FILE */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Langkah 1: Pilih Data & Unggah File</CardTitle>
            <CardDescription>
              Mendukung format file spreadsheet .xlsx, .xls, atau .csv (maksimal 10 MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFileUpload} className="space-y-6">
              <div className="space-y-2">
                <Label>Pilih Jenis Data yang Akan Diimpor</Label>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button
                    type="button"
                    onClick={() => setImportType("BARANG")}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      importType === "BARANG"
                        ? "border-[#0B3B2C] bg-emerald-50/50 ring-2 ring-[#0B3B2C]/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl mb-1">📦</span>
                    <span className="font-bold text-sm text-[#0B3B2C]">Data Barang & Stok</span>
                    <span className="text-xs text-gray-500">Katalog barang, harga jual/beli, dan stok awal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportType("ANGGOTA")}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      importType === "ANGGOTA"
                        ? "border-[#0B3B2C] bg-emerald-50/50 ring-2 ring-[#0B3B2C]/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl mb-1">👥</span>
                    <span className="font-bold text-sm text-[#0B3B2C]">Data Anggota</span>
                    <span className="text-xs text-gray-500">Nomor anggota, nama, kontak, dan alamat</span>
                  </button>
                </div>
              </div>

              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="fileInput">Pilih Berkas Spreadsheet</Label>
                <div className="border-2 border-dashed border-gray-200 hover:border-[#0B3B2C] rounded-2xl p-8 text-center transition-colors bg-gray-50/50">
                  <FileUp className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">
                    {file ? file.name : "Klik untuk memilih file Excel atau CSV"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, atau .csv (maks. 10 MB)</p>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => document.getElementById("fileInput")?.click()}
                  >
                    {file ? "Ganti File" : "Pilih File"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={!file || isPending} className="flex items-center gap-2">
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Menganalisis...
                    </>
                  ) : (
                    <>
                      Lanjut ke Pemetaan Kolom <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {currentStep === 2 && analysisData && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-bold">Langkah 2: Pemetaan Kolom Excel ke Sistem Kopify</CardTitle>
                <CardDescription>
                  File: <b>{analysisData.filename}</b> ({analysisData.totalRows} baris). Sistem telah mencocokkan kolom secara otomatis.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800">
                {importType === "BARANG" ? "Impor Barang" : "Impor Anggota"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Template loader */}
            {savedTemplates.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">Gunakan template tersimpan:</span>
                <div className="flex gap-2">
                  {savedTemplates.map((t) => (
                    <Button
                      key={t.id}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setMappings(t.mappingJson);
                        toast.success(`Template '${t.name}' diterapkan`);
                      }}
                    >
                      <Layers className="h-3 w-3 mr-1" /> {t.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Mapping Table */}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-1/3">Kolom File Excel Anda</TableHead>
                    <TableHead className="w-1/3">Petakan ke Field Sistem Kopify</TableHead>
                    <TableHead className="w-1/3">Contoh Nilai (Baris 1)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisData.headers.map((header) => {
                    const currentMappedField = mappings[header] || "NONE";
                    const sampleVal = analysisData.sampleRows[0]?.[header] || "-";

                    return (
                      <TableRow key={header}>
                        <TableCell className="font-bold text-gray-800">
                          {header}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={currentMappedField}
                            onValueChange={(val) => {
                              setMappings({
                                ...mappings,
                                [header]: val === "NONE" ? "" : (val ?? ""),
                              });
                            }}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="-- Jangan Impor Kolom Ini --" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">-- Jangan Impor Kolom Ini --</SelectItem>
                              {schemaFields.map((f) => (
                                <SelectItem key={f.field} value={f.field}>
                                  {f.label} {f.required && "* (Wajib)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono truncate max-w-xs">
                          {sampleVal}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Save Mapping Template */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Nama template (misal: Format Excel Toko Lama)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="text-xs border rounded-xl px-3 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" variant="secondary" onClick={handleSaveTemplate}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Simpan Template
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
                </Button>
                <Button onClick={handleProceedToValidation} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> Memvalidasi...
                    </>
                  ) : (
                    <>
                      Lanjut ke Pratinjau <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: PREVIEW & VALIDATION */}
      {currentStep === 3 && validationSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Langkah 3: Pratinjau & Hasil Validasi</CardTitle>
            <CardDescription>
              Menampilkan 20 baris pertama data yang dinormalisasi dan daftar baris yang terindikasi error
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stat Badges */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 p-4 rounded-2xl border">
                <span className="text-xs text-gray-500">Total Baris File</span>
                <p className="text-2xl font-extrabold text-gray-800">{validationSummary.totalRows}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <span className="text-xs text-emerald-700">Baris Siap Diimpor</span>
                <p className="text-2xl font-extrabold text-emerald-700">{validationSummary.validCount}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
                <span className="text-xs text-red-700">Baris Terindikasi Error</span>
                <p className="text-2xl font-extrabold text-red-700">{validationSummary.errorCount}</p>
              </div>
            </div>

            {/* Error alerts list if any */}
            {validationSummary.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-1.5 text-amber-900 max-h-40 overflow-y-auto">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="h-4 w-4" /> Daftar Error Terdeteksi:
                </p>
                {validationSummary.errors.slice(0, 10).map((err: any, i: number) => (
                  <p key={i}>
                    • <b>Baris {err.row}:</b> {err.message} {err.rawValue ? `(Nilai: "${err.rawValue}")` : ""}
                  </p>
                ))}
                {validationSummary.errors.length > 10 && (
                  <p className="font-semibold text-gray-500">
                    ...dan {validationSummary.errors.length - 10} error lainnya.
                  </p>
                )}
              </div>
            )}

            {/* Preview Table */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Pratinjau Data (20 Baris Pertama):</p>
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50 text-xs">
                    <TableRow>
                      <TableHead>Baris</TableHead>
                      <TableHead>Status</TableHead>
                      {schemaFields.map((f) => (
                        <TableHead key={f.field}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationSummary.previewRows.map((pr: any) => (
                      <TableRow key={pr.row} className={!pr.isValid ? "bg-red-50/40" : ""}>
                        <TableCell className="font-mono text-xs">{pr.row}</TableCell>
                        <TableCell>
                          <Badge variant={pr.isValid ? "default" : "destructive"} className="text-[10px]">
                            {pr.isValid ? "Valid" : "Error"}
                          </Badge>
                        </TableCell>
                        {schemaFields.map((f) => (
                          <TableCell key={f.field} className="text-xs truncate max-w-[150px]">
                            {pr.data[f.field] !== null && pr.data[f.field] !== undefined
                              ? String(pr.data[f.field])
                              : "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mode Duplikat & Navigation */}
            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2 max-w-md">
                <Label>Pilih Perlakuan Data Duplikat (FR-3.1)</Label>
                <Select
                  value={duplicateMode}
                  onValueChange={(val) => setDuplicateMode((val as DuplicateMode) || "SKIP")}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SKIP">Lewati (Data lama tidak diubah, abaikan duplikat)</SelectItem>
                    <SelectItem value="UPDATE">Perbarui (Timpa data lama dengan data baru dari file)</SelectItem>
                    <SelectItem value="ERROR">Tandai Error (Gagalkan baris jika sudah terdaftar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Ubah Pemetaan
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={isPending || validationSummary.validCount === 0}
                  className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-bold"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> Mengeksekusi Impor...
                    </>
                  ) : (
                    <>
                      Konfirmasi & Jalankan Impor <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: EXECUTION RESULT */}
      {currentStep === 4 && executionResult && (
        <Card className="border-emerald-200">
          <CardHeader className="text-center pt-8 pb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl font-extrabold text-[#0B3B2C]">Impor Data Selesai!</CardTitle>
            <CardDescription>
              Seluruh proses impor telah dicatat secara transaksional di database Kopify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center max-w-lg mx-auto">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <span className="text-xs text-emerald-700 font-semibold">Berhasil Diimpor</span>
                <p className="text-2xl font-extrabold text-emerald-700">{executionResult.success}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border">
                <span className="text-xs text-gray-500 font-semibold">Dilewati</span>
                <p className="text-2xl font-extrabold text-gray-700">{executionResult.skipped}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
                <span className="text-xs text-red-700 font-semibold">Gagal</span>
                <p className="text-2xl font-extrabold text-red-700">{executionResult.failed}</p>
              </div>
            </div>

            {executionResult.failureReports?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs space-y-1 text-red-900 max-w-lg mx-auto">
                <p className="font-bold">Baris yang Gagal Diproses:</p>
                {executionResult.failureReports.map((f: any, idx: number) => (
                  <p key={idx}>
                    • <b>Baris {f.row} ({f.identifier}):</b> {f.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="text-center pt-4">
              <Button onClick={resetWizard} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Lakukan Impor Data Lain
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IMPORT HISTORY LOGS (FR-3.3) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Riwayat Log Impor Data (Audit Trail)
          </CardTitle>
          <p className="text-xs text-gray-500">
            Setiap aksi impor dicatat otomatis meliputi nama file, total baris, jumlah sukses/gagal, dan operator
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 text-xs">
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Nama File</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Total Baris</TableHead>
                  <TableHead className="text-right">Sukses</TableHead>
                  <TableHead className="text-right">Gagal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Operator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-gray-500 text-xs">
                      Belum ada riwayat impor yang tercatat.
                    </TableCell>
                  </TableRow>
                ) : (
                  historyLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-gray-900">{log.filename}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{log.totalRows}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-emerald-600">{log.successRows}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-red-600">{log.failedRows}</TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "SUKSES" ? "default" : log.status === "PARSIAL" ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{log.createdBy.username}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

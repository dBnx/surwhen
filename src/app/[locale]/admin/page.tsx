"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import type { SurveyWithHash } from "~/lib/surveys";
import { useToast } from "~/components/ToastProvider";

interface SurveysResponse {
  defaultTargetEmail: string;
  surveys: SurveyWithHash[];
}

interface ErrorResponse {
  error: string;
  errors?: string[];
}

// SuccessResponse removed (unused)

interface FormDataState {
  title: string;
  description: string;
  reasons: string;
  targetEmail: string;
}

export default function AdminPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [defaultEmail, setDefaultEmail] = useState("");
  const [defaultEmailInput, setDefaultEmailInput] = useState("");
  const [surveys, setSurveys] = useState<SurveyWithHash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState("#808080");

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [originalTitle, setOriginalTitle] = useState<string>("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStrategy, setUploadStrategy] = useState<"replace" | "merge">("replace");
  const [conflictPreference, setConflictPreference] = useState<"source" | "existing">("source");
  const [qrModalHash, setQrModalHash] = useState<string | null>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const colorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAccentColorUpdateRef = useRef<number>(0);
  const RATE_LIMIT_WINDOW_MS = 500;

  const [formData, setFormData] = useState<FormDataState>({
    title: "",
    description: "",
    reasons: "",
    targetEmail: "",
  });

  const fetchSurveys = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/admin/surveys?token=${token}`);
      if (response.status === 401) {
        const errorMessage = t("invalidToken");
        setError(errorMessage);
        toast.showError(errorMessage);
        setLoading(false);
        return;
      }
      if (!response.ok) {
        throw new Error(t("failedToLoad"));
      }
      const data = (await response.json()) as SurveysResponse;
      setSurveys(data.surveys);
      setDefaultEmail(data.defaultTargetEmail);
      setDefaultEmailInput(data.defaultTargetEmail);
      setLoading(false);
    } catch {
      const errorMessage = t("failedToLoad");
      setError(errorMessage);
      toast.showError(errorMessage);
      setLoading(false);
    }
  }, [token, t, toast]);

  const fetchAccentColor = useCallback(async (): Promise<void> => {
    document.documentElement.style.setProperty(
      "--color-gradient-start",
      "#808080",
    );
    try {
      const response = await fetch("/api/accent-color");
      if (response.ok) {
        const data = (await response.json()) as { accentColor: string };
        setAccentColor(data.accentColor);
        document.documentElement.style.setProperty(
          "--color-gradient-start",
          data.accentColor,
        );
      } else {
        document.documentElement.style.setProperty(
          "--color-gradient-start",
          "#2563eb",
        );
        setAccentColor("#2563eb");
      }
    } catch {
      document.documentElement.style.setProperty(
        "--color-gradient-start",
        "#2563eb",
      );
      setAccentColor("#2563eb");
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setError(t("tokenRequired"));
      setLoading(false);
      return;
    }

    void fetchSurveys();
    void fetchAccentColor();
  }, [fetchSurveys, fetchAccentColor, token, t]);

  useEffect(() => {
    const titleText = t("title");
    if (titleText) {
      document.title = `SurWhen: ${titleText}`;
    }
  });

  useEffect(() => {
    return () => {
      if (colorUpdateTimeoutRef.current) {
        clearTimeout(colorUpdateTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const reasonsArray = formData.reasons
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      const surveyData: {
        title: string;
        description: string;
        reasons: string[];
        targetEmail?: string | null;
      } = {
        title: formData.title,
        description: formData.description,
        reasons: reasonsArray,
      };

      // Handle targetEmail: if empty, send null to explicitly clear it (for edits)
      // For new surveys, omit it to use default
      if (formData.targetEmail && formData.targetEmail.trim().length > 0) {
        surveyData.targetEmail = formData.targetEmail.trim();
      } else if (editingHash) {
        // When editing, explicitly set to null to clear existing targetEmail
        surveyData.targetEmail = null;
      }

      const url = editingHash
        ? `/api/admin/surveys?token=${token}`
        : `/api/admin/surveys?token=${token}`;
      const method = editingHash ? "PUT" : "POST";

      const body = editingHash
        ? { hash: editingHash, ...surveyData }
        : surveyData;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;
        throw new Error(data.error || t("failedToSave"));
      }

      const successMessage = editingHash ? t("surveyUpdated") : t("surveyAdded");
      toast.showSuccess(successMessage);
      setShowAddForm(false);
      setEditingHash(null);
      setOriginalTitle("");
      setFormData({ title: "", description: "", reasons: "", targetEmail: "" });
      await fetchSurveys();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("failedToSave");
      setError(errorMessage);
      toast.showError(errorMessage);
    }
  };

  const handleEdit = (survey: SurveyWithHash): void => {
    setEditingHash(survey.hash);
    setOriginalTitle(survey.title);
    setFormData({
      title: survey.title,
      description: survey.description,
      reasons: survey.reasons.join("\n"),
      targetEmail: survey.targetEmail ?? "",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (hash: string): Promise<void> => {
    if (!confirm(t("deleteConfirm"))) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/surveys?token=${token}&hash=${hash}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(t("failedToDelete"));
      }

      toast.showSuccess(t("surveyDeleted"));
      await fetchSurveys();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("failedToDelete");
      setError(errorMessage);
      toast.showError(errorMessage);
    }
  };

  const handleUpdateDefaultEmail = async (
    e: React.FormEvent,
  ): Promise<void> => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch(`/api/admin/config?token=${token}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ defaultTargetEmail: defaultEmailInput }),
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;
        throw new Error(data.error || t("failedToUpdateEmail"));
      }

      setDefaultEmail(defaultEmailInput);
      toast.showSuccess(t("defaultEmailUpdated"));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("failedToUpdateEmail");
      setError(errorMessage);
      toast.showError(errorMessage);
    }
  };

  const isValidHexColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  const handleAccentColorChange = (newColor: string): void => {
    setAccentColor(newColor);
  };

  const handleColorPickerChange = (newColor: string): void => {
    setAccentColor(newColor);
    if (isValidHexColor(newColor)) {
      document.documentElement.style.setProperty(
        "--color-gradient-start",
        newColor,
      );
      
      const body = document.body;
      const html = document.documentElement;
      
      const gradient = `linear-gradient(to bottom right, ${newColor}, var(--color-gradient-mid), var(--color-gradient-end))`;
      body.style.backgroundImage = gradient;
      html.style.backgroundImage = gradient;
      
      requestAnimationFrame(() => {
        void body.offsetHeight;
      });
      
      if (colorUpdateTimeoutRef.current) {
        clearTimeout(colorUpdateTimeoutRef.current);
      }
      
      colorUpdateTimeoutRef.current = setTimeout(() => {
        void handleUpdateAccentColor(newColor);
        colorUpdateTimeoutRef.current = null;
      }, 500);
    }
  };

  const handleUpdateAccentColor = async (colorToSave?: string): Promise<void> => {
    const color = colorToSave ?? accentColor;
    if (!isValidHexColor(color)) {
      toast.showError(t("failedToUpdateAccentColor"));
      return;
    }

    const now = Date.now();
    if (now - lastAccentColorUpdateRef.current < RATE_LIMIT_WINDOW_MS) {
      toast.showError(t("tooManyRequests") || "Too many requests. Please wait before updating again.");
      return;
    }

    lastAccentColorUpdateRef.current = now;
    setError(null);

    try {
      const response = await fetch(`/api/admin/config?token=${token}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accentColor: color }),
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;
        throw new Error(data.error || t("failedToUpdateAccentColor"));
      }

      document.documentElement.style.setProperty(
        "--color-gradient-start",
        color,
      );
      
      const body = document.body;
      const html = document.documentElement;
      const gradient = `linear-gradient(to bottom right, ${color}, var(--color-gradient-mid), var(--color-gradient-end))`;
      body.style.backgroundImage = gradient;
      html.style.backgroundImage = gradient;
      
      if (typeof window !== "undefined") {
        sessionStorage.setItem("accent-color-last-update", Date.now().toString());
        sessionStorage.setItem("accent-color-last-color", color);
      }
      
      toast.showSuccess(t("accentColorUpdated"));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("failedToUpdateAccentColor");
      setError(errorMessage);
      toast.showError(errorMessage);
    }
  };

  const handleResetAccentColor = async (): Promise<void> => {
    const defaultColor = "#2563eb";
    
    const now = Date.now();
    if (now - lastAccentColorUpdateRef.current < RATE_LIMIT_WINDOW_MS) {
      toast.showError(t("tooManyRequests") || "Too many requests. Please wait before updating again.");
      return;
    }

    lastAccentColorUpdateRef.current = now;
    setAccentColor(defaultColor);
    document.documentElement.style.setProperty(
      "--color-gradient-start",
      defaultColor,
    );
    
    const body = document.body;
    const html = document.documentElement;
    const gradient = `linear-gradient(to bottom right, ${defaultColor}, var(--color-gradient-mid), var(--color-gradient-end))`;
    body.style.backgroundImage = gradient;
    html.style.backgroundImage = gradient;
    
    setError(null);
    try {
      const response = await fetch(`/api/admin/config?token=${token}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accentColor: null }),
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;
        throw new Error(data.error || t("failedToUpdateAccentColor"));
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("accent-color-last-update", Date.now().toString());
        sessionStorage.setItem("accent-color-last-color", defaultColor);
      }

      toast.showSuccess(t("accentColorUpdated"));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("failedToUpdateAccentColor");
      setError(errorMessage);
      toast.showError(errorMessage);
    }
  };

  const copyLink = (hash: string): void => {
    const link = `${window.location.origin}/survey/${hash}`;
    void navigator.clipboard.writeText(link);
    toast.showSuccess(t("linkCopied"));
  };

  const convertQRToCanvas = (callback: (canvas: HTMLCanvasElement) => void): void => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const qrCodeSvg = qrCodeRef.current?.querySelector("svg");
    if (!qrCodeSvg) return;

    const svgData = new XMLSerializer().serializeToString(qrCodeSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      callback(canvas);
    };
    img.src = url;
  };

  const handleDownloadQR = (hash: string): void => {
    convertQRToCanvas((canvas) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `qr-code-${hash}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, "image/png");
    });
  };

  const handleCopyQRImage = async (): Promise<void> => {
    try {
      convertQRToCanvas((canvas) => {
        canvas.toBlob((blob) => {
          if (!blob) return;
          void (async () => {
            const item = new ClipboardItem({ "image/png": blob });
            await navigator.clipboard.write([item]);
            toast.showSuccess(t("qrCodeCopied"));
          })();
        }, "image/png");
      });
    } catch (_err) {
      toast.showError(t("failedToCopy") || "Failed to copy QR code");
    }
  };

  const handleDownloadConfig = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/admin/config?token=${token}`);
      if (!response.ok) {
        throw new Error(t("failedToDownload"));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "surveys.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.showSuccess(t("configDownloaded"));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("failedToDownload");
      toast.showError(errorMessage);
    }
  };

  const handleUploadConfig = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];

    if (!file) {
      const errorMessage = t("selectConfigFile");
      setError(errorMessage);
      toast.showError(errorMessage);
      return;
    }

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("strategy", uploadStrategy);
      if (uploadStrategy === "merge") {
        uploadFormData.append("conflictPreference", conflictPreference);
      }

      const response = await fetch(`/api/admin/config?token=${token}`, {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;
        throw new Error(data.error || t("failedToUpload"));
      }

      toast.showSuccess(t("configUploaded"));
      form.reset();
      setShowUploadModal(false);
      setUploadStrategy("replace");
      setConflictPreference("source");
      await fetchSurveys();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("failedToUpload");
      setError(errorMessage);
      toast.showError(errorMessage);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white">
        <p>{tCommon("loading")}</p>
      </main>
    );
  }

  if (error && !token) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white p-8 pt-20 sm:pt-8">
      <div className="container mx-auto max-w-6xl">
        <h1 className="mb-8 text-4xl font-extrabold tracking-tight drop-shadow-lg">
          {t("title")}
        </h1>

        {/* Default Email Configuration */}
        <div className="mb-8 rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20">
          <h2 className="mb-4 text-2xl font-bold">{t("defaultTargetEmail")}</h2>
          {(!defaultEmail || defaultEmail.trim() === "") && (
            <div className="mb-4 rounded-lg bg-red-500/20 p-4 text-red-300 border border-red-400/30">
              <strong>{t("defaultTargetEmailWarning")}</strong>
            </div>
          )}
          <form onSubmit={handleUpdateDefaultEmail} className="flex flex-wrap gap-4">
            <input
              type="email"
              value={defaultEmailInput}
              onChange={(e) => setDefaultEmailInput(e.target.value)}
              className="flex-1 min-w-0 rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
              placeholder={t("defaultTargetEmailPlaceholder")}
              maxLength={500}
              required
            />
            <button
              type="submit"
              className="w-full sm:w-auto rounded-lg bg-white/25 px-6 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {tCommon("update")}
            </button>
          </form>
        </div>


        {/* Add/Edit Survey Form */}
        {showAddForm && (
          <div className="mb-8 rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20">
            <h2 className="mb-4 text-2xl font-bold">
              {editingHash ? t("editSurvey") : t("addNewSurvey")}
            </h2>
            {editingHash && formData.title !== originalTitle && (
              <div className="mb-4 rounded-lg bg-yellow-500/20 p-4 text-yellow-300">
                <strong>{t("titleWarning")}</strong>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t("titleLabel")}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                  maxLength={1000}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t("descriptionLabel")}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                  rows={3}
                  maxLength={5000}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  {t("reasonsLabel")}
                </label>
                <textarea
                  value={formData.reasons}
                  onChange={(e) =>
                    setFormData({ ...formData, reasons: e.target.value })
                  }
                  className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                  rows={4}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  maxLength={10000}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t("targetEmailLabel")}</label>
                <p className="text-sm text-white/70">{t("targetEmailDescription")}</p>
                <input
                  type="email"
                  value={formData.targetEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, targetEmail: e.target.value })
                  }
                  className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                  placeholder={t("targetEmailPlaceholder")}
                  maxLength={500}
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="rounded-lg bg-white/25 px-6 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  {editingHash ? t("updateSurveyButton") : t("addSurveyButton")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingHash(null);
                    setOriginalTitle("");
                    setFormData({
                      title: "",
                      description: "",
                      reasons: "",
                      targetEmail: "",
                    });
                    setError(null);
                  }}
                  className="rounded-lg bg-white/15 px-6 py-2 font-medium text-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  {tCommon("cancel")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Surveys List */}
        <div className="rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold">{t("surveys")}</h2>
            {!showAddForm && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadConfig}
                  className="rounded-lg bg-blue-500/30 px-4 py-2 font-medium text-white hover:bg-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t("downloadButton")}
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="rounded-lg bg-red-500/30 px-4 py-2 font-medium text-white hover:bg-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t("uploadButton")}
                </button>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="rounded-lg bg-white/25 px-4 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t("addSurvey")}
                </button>
              </div>
            )}
          </div>

          {surveys.length === 0 ? (
            <p className="text-white/60">{t("surveysEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-2 text-left">{t("surveysTable.title")}</th>
                    <th className="px-4 py-2 text-left">{t("surveysTable.link")}</th>
                    <th className="px-4 py-2 text-left">{t("surveysTable.targetEmail")}</th>
                    <th className="px-4 py-2 text-left">{t("surveysTable.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys.map((survey) => (
                    <tr
                      key={survey.hash}
                      className="border-b border-white/10"
                    >
                      <td className="px-4 py-2">{survey.title}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => copyLink(survey.hash)}
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          /survey/{survey.hash}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        {survey.targetEmail ?? (
                          <span className="text-white/60">
                            {t("defaultTarget", { email: defaultEmail })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setQrModalHash(survey.hash)}
                            className="rounded bg-green-500/20 px-3 py-1 text-sm text-green-300 hover:bg-green-500/30 flex items-center gap-1"
                            title={t("qrCodeTitle")}
                          >
                            <QrCode size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(survey)}
                            className="rounded bg-blue-500/20 px-3 py-1 text-sm text-blue-300 hover:bg-blue-500/30"
                          >
                            {tCommon("edit")}
                          </button>
                          <button
                            onClick={() => handleDelete(survey.hash)}
                            className="rounded bg-red-500/20 px-3 py-1 text-sm text-red-300 hover:bg-red-500/30"
                          >
                            {tCommon("delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Styling Section */}
        <div className="mt-8 rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20">
          <h2 className="mb-4 text-2xl font-bold">{t("styling")}</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
              <label className="text-sm font-medium flex-shrink-0">{t("accentColor")}</label>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleColorPickerChange(e.target.value)}
                  className="h-12 w-20 rounded-lg cursor-pointer border-2 border-white/30 bg-white/25 hover:bg-white/35 transition-all flex-shrink-0"
                  title={accentColor}
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 7) {
                      handleAccentColorChange(value);
                    }
                  }}
                  className={`rounded-lg px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 transition-all font-mono text-sm flex-1 min-w-0 ${
                    isValidHexColor(accentColor)
                      ? "bg-white/25 focus:ring-white/70 focus:bg-white/30"
                      : "bg-red-500/30 border-2 border-red-400/50 focus:ring-red-400/70 focus:bg-red-500/40"
                  }`}
                  maxLength={7}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#000000"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <button
                  onClick={() => void handleUpdateAccentColor()}
                  disabled={!isValidHexColor(accentColor)}
                  className="rounded-lg bg-white/25 px-4 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                >
                  {tCommon("apply")}
                </button>
                <button
                  onClick={handleResetAccentColor}
                  className="rounded-lg bg-white/15 px-4 py-2 font-medium text-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 whitespace-nowrap"
                >
                  {t("accentColorReset")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20 w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl mx-4">
              <h2 className="mb-4 text-2xl font-bold">{t("uploadModalTitle")}</h2>
              <form onSubmit={handleUploadConfig} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept=".json"
                    className="rounded-lg bg-white/25 px-4 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/25 file:text-white file:cursor-pointer file:hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-base font-semibold">{t("uploadModalStrategyLabel")}</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="strategy"
                        value="replace"
                        checked={uploadStrategy === "replace"}
                        onChange={(e) => setUploadStrategy(e.target.value as "replace" | "merge")}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{t("uploadModalStrategyReplace")}</div>
                        <div className="text-sm text-white/70">{t("uploadModalStrategyReplaceDescription")}</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="strategy"
                        value="merge"
                        checked={uploadStrategy === "merge"}
                        onChange={(e) => setUploadStrategy(e.target.value as "replace" | "merge")}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{t("uploadModalStrategyMerge")}</div>
                        <div className="text-sm text-white/70">{t("uploadModalStrategyMergeDescription")}</div>
                      </div>
                    </label>
                  </div>
                </div>

                {uploadStrategy === "merge" && (
                  <div className="flex flex-col gap-2">
                    <label className="text-base font-semibold">{t("uploadModalConflictLabel")}</label>
                    <p className="text-sm text-white/70 mb-2">{t("uploadModalStrategyDescription")}</p>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="conflictPreference"
                          value="source"
                          checked={conflictPreference === "source"}
                          onChange={(e) => setConflictPreference(e.target.value as "source" | "existing")}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{t("uploadModalConflictSource")}</div>
                          <div className="text-sm text-white/70">{t("uploadModalConflictSourceDescription")}</div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="conflictPreference"
                          value="existing"
                          checked={conflictPreference === "existing"}
                          onChange={(e) => setConflictPreference(e.target.value as "source" | "existing")}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{t("uploadModalConflictExisting")}</div>
                          <div className="text-sm text-white/70">{t("uploadModalConflictExistingDescription")}</div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="rounded-lg bg-white/25 px-6 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t("uploadConfigButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadStrategy("replace");
                      setConflictPreference("source");
                      setError(null);
                    }}
                    className="rounded-lg bg-white/15 px-6 py-2 font-medium text-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {qrModalHash && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20 w-full max-w-[calc(100vw-2rem)] sm:max-w-md mx-4">
              <h2 className="mb-4 text-2xl font-bold">{t("qrCodeTitle")}</h2>
              <div className="flex flex-col items-center gap-4">
                <div
                  ref={qrCodeRef}
                  className="rounded-lg bg-white p-4 flex items-center justify-center"
                >
                  <QRCodeSVG
                    value={`${window.location.origin}/survey/${qrModalHash}`}
                    size={256}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p className="text-white/80 text-sm break-all text-center">
                  {`${window.location.origin}/survey/${qrModalHash}`}
                </p>
                <div className="flex gap-4 w-full">
                  <button
                    onClick={() => {
                      handleDownloadQR(qrModalHash);
                    }}
                    className="flex-1 rounded-lg bg-blue-500/30 px-6 py-2 font-medium text-white hover:bg-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t("downloadQRCode")}
                  </button>
                  <button
                    onClick={() => void handleCopyQRImage()}
                    className="flex-1 rounded-lg bg-white/25 px-6 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Copy Image
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQrModalHash(null);
                  }}
                  className="w-full rounded-lg bg-white/15 px-6 py-2 font-medium text-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  {tCommon("cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


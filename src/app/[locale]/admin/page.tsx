"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
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

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [originalTitle, setOriginalTitle] = useState<string>("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStrategy, setUploadStrategy] = useState<"replace" | "merge">("replace");
  const [conflictPreference, setConflictPreference] = useState<"source" | "existing">("source");

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

  useEffect(() => {
    if (!token) {
      setError(t("tokenRequired"));
      setLoading(false);
      return;
    }

    void fetchSurveys();
  }, [fetchSurveys, token, t]);

  useEffect(() => {
    if (t) {
      document.title = `SurWhen: ${t("title")}`;
    }
  }, [t]);

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

  const copyLink = (hash: string): void => {
    const link = `${window.location.origin}/survey/${hash}`;
    void navigator.clipboard.writeText(link);
    toast.showSuccess(t("linkCopied"));
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
    <main className="min-h-screen text-white p-8">
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
          <form onSubmit={handleUpdateDefaultEmail} className="flex gap-4">
            <input
              type="email"
              value={defaultEmailInput}
              onChange={(e) => setDefaultEmailInput(e.target.value)}
              className="flex-1 rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
              placeholder={t("defaultTargetEmailPlaceholder")}
              maxLength={500}
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-white/25 px-6 py-2 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">{t("surveys")}</h2>
            {!showAddForm && (
              <div className="flex gap-2">
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
                        <div className="flex gap-2">
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

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="rounded-2xl bg-white/15 backdrop-blur-md p-6 shadow-2xl border border-white/20 max-w-2xl w-full mx-4">
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
                  <p className="text-sm text-white/70 mb-2">{t("uploadModalStrategyDescription")}</p>
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
      </div>
    </main>
  );
}


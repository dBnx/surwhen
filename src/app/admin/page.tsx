"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { SurveyWithHash } from "~/lib/surveys";

interface SurveysResponse {
  defaultTargetEmail: string;
  surveys: SurveyWithHash[];
}

export default function AdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [defaultEmail, setDefaultEmail] = useState("");
  const [surveys, setSurveys] = useState<SurveyWithHash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [originalTitle, setOriginalTitle] = useState<string>("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reasons: "",
    targetEmail: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Token is required. Access /admin?token=secret");
      setLoading(false);
      return;
    }

    fetchSurveys();
  }, [token]);

  const fetchSurveys = async () => {
    try {
      const response = await fetch(`/api/admin/surveys?token=${token}`);
      if (response.status === 401) {
        setError("Invalid token");
        setLoading(false);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch surveys");
      }
      const data: SurveysResponse = await response.json();
      setSurveys(data.surveys);
      setDefaultEmail(data.defaultTargetEmail);
      setLoading(false);
    } catch (err) {
      setError("Failed to load surveys");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
        const data = await response.json();
        throw new Error(data.error || "Failed to save survey");
      }

      setSuccess(editingHash ? "Survey updated successfully" : "Survey added successfully");
      setShowAddForm(false);
      setEditingHash(null);
      setOriginalTitle("");
      setFormData({ title: "", description: "", reasons: "", targetEmail: "" });
      await fetchSurveys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save survey");
    }
  };

  const handleEdit = (survey: SurveyWithHash) => {
    setEditingHash(survey.hash);
    setOriginalTitle(survey.title);
    setFormData({
      title: survey.title,
      description: survey.description,
      reasons: survey.reasons.join("\n"),
      targetEmail: survey.targetEmail || "",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (hash: string) => {
    if (!confirm("Are you sure you want to delete this survey?")) {
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
        throw new Error("Failed to delete survey");
      }

      setSuccess("Survey deleted successfully");
      await fetchSurveys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete survey");
    }
  };

  const handleUpdateDefaultEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/config?token=${token}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ defaultTargetEmail: defaultEmail }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update default email");
      }

      setSuccess("Default email updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update default email");
    }
  };

  const copyLink = (hash: string) => {
    const link = `${window.location.origin}/survey/${hash}`;
    navigator.clipboard.writeText(link);
    setSuccess("Link copied to clipboard!");
    setTimeout(() => setSuccess(null), 2000);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <p>Loading...</p>
      </main>
    );
  }

  if (error && !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white p-8">
      <div className="container mx-auto max-w-6xl">
        <h1 className="mb-8 text-4xl font-extrabold tracking-tight">
          Admin Panel
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 p-4 text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-500/20 p-4 text-green-400">
            {success}
          </div>
        )}

        {/* Default Email Configuration */}
        <div className="mb-8 rounded-xl bg-white/10 p-6">
          <h2 className="mb-4 text-2xl font-bold">Default Target Email</h2>
          <form onSubmit={handleUpdateDefaultEmail} className="flex gap-4">
            <input
              type="email"
              value={defaultEmail}
              onChange={(e) => setDefaultEmail(e.target.value)}
              className="flex-1 rounded-lg bg-white/20 px-4 py-2 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="default@example.com"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-white/20 px-6 py-2 font-medium text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Update
            </button>
          </form>
        </div>

        {/* Add/Edit Survey Form */}
        {showAddForm && (
          <div className="mb-8 rounded-xl bg-white/10 p-6">
            <h2 className="mb-4 text-2xl font-bold">
              {editingHash ? "Edit Survey" : "Add New Survey"}
            </h2>
            {editingHash && formData.title !== originalTitle && (
              <div className="mb-4 rounded-lg bg-yellow-500/20 p-4 text-yellow-300">
                <strong>Warning:</strong> Changing the title will invalidate the shared URL.
                The survey hash is generated from the title, so any existing links will no longer
                work.
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="rounded-lg bg-white/20 px-4 py-2 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="rounded-lg bg-white/20 px-4 py-2 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  rows={3}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  Reasons (one per line) *
                </label>
                <textarea
                  value={formData.reasons}
                  onChange={(e) =>
                    setFormData({ ...formData, reasons: e.target.value })
                  }
                  className="rounded-lg bg-white/20 px-4 py-2 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  rows={4}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Target Email (optional)</label>
                <input
                  type="email"
                  value={formData.targetEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, targetEmail: e.target.value })
                  }
                  className="rounded-lg bg-white/20 px-4 py-2 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="Leave empty to use default"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="rounded-lg bg-white/20 px-6 py-2 font-medium text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {editingHash ? "Update" : "Add"} Survey
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
                    setSuccess(null);
                  }}
                  className="rounded-lg bg-white/10 px-6 py-2 font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Surveys List */}
        <div className="rounded-xl bg-white/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Surveys</h2>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="rounded-lg bg-white/20 px-4 py-2 font-medium text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Add Survey
              </button>
            )}
          </div>

          {surveys.length === 0 ? (
            <p className="text-white/60">No surveys yet. Add one to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Link</th>
                    <th className="px-4 py-2 text-left">Target Email</th>
                    <th className="px-4 py-2 text-left">Actions</th>
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
                        {survey.targetEmail ? (
                          survey.targetEmail
                        ) : (
                          <span className="text-white/60">
                            Default Target: {defaultEmail}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(survey)}
                            className="rounded bg-blue-500/20 px-3 py-1 text-sm text-blue-300 hover:bg-blue-500/30"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(survey.hash)}
                            className="rounded bg-red-500/20 px-3 py-1 text-sm text-red-300 hover:bg-red-500/30"
                          >
                            Delete
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
      </div>
    </main>
  );
}


import { createHash } from "crypto";
import surveysConfig from "../../surveys.json";

export interface Survey {
  title: string;
  description: string;
  reasons: string[];
  targetEmail?: string;
}

export interface SurveysConfig {
  defaultTargetEmail: string;
  surveys: Survey[];
}

export function getSurveysConfig(): SurveysConfig {
  return surveysConfig as SurveysConfig;
}

export function generateHashFromTitle(title: string): string {
  const hash = createHash("sha256").update(title).digest("hex");
  // Use first 16 characters of hash for shorter URLs
  return hash.substring(0, 16);
}

export function getSurveyByHash(hash: string): Survey | null {
  const config = getSurveysConfig();
  
  for (const survey of config.surveys) {
    const surveyHash = generateHashFromTitle(survey.title);
    if (surveyHash === hash) {
      return survey;
    }
  }
  
  return null;
}

export function getTargetEmail(survey: Survey): string {
  const config = getSurveysConfig();
  return survey.targetEmail ?? config.defaultTargetEmail;
}

export interface SurveyWithHash extends Survey {
  hash: string;
}

export function getAllSurveysWithHashes(): SurveyWithHash[] {
  const config = getSurveysConfig();
  return config.surveys.map((survey) => ({
    ...survey,
    hash: generateHashFromTitle(survey.title),
  }));
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateSurvey(survey: Partial<Survey>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!survey.title || survey.title.trim().length === 0) {
    errors.push("Title is required");
  }

  if (!survey.description || survey.description.trim().length === 0) {
    errors.push("Description is required");
  }

  if (
    !survey.reasons ||
    !Array.isArray(survey.reasons) ||
    survey.reasons.length === 0
  ) {
    errors.push("At least one reason option is required");
  }

  if (survey.targetEmail && !isValidEmail(survey.targetEmail)) {
    errors.push("Invalid target email format");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


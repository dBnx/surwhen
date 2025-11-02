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


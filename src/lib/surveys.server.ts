import { promises as fs } from "fs";
import { join } from "path";
import type {
  Survey,
  SurveysConfig,
} from "~/lib/surveys";
import {
  getSurveysConfig,
  generateHashFromTitle,
  isValidEmail,
} from "~/lib/surveys";

async function getSurveysJsonPath(): Promise<string> {
  return join(process.cwd(), "surveys.json");
}

export async function saveSurveysConfig(
  config: SurveysConfig,
): Promise<void> {
  const filePath = await getSurveysJsonPath();
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export async function addSurvey(survey: Survey): Promise<void> {
  const config = getSurveysConfig();

  // Check for duplicate title
  if (config.surveys.some((s) => s.title === survey.title)) {
    throw new Error("A survey with this title already exists");
  }

  config.surveys.push(survey);
  await saveSurveysConfig(config);
}

export async function updateSurvey(
  hash: string,
  updates: Partial<Survey>,
): Promise<void> {
  const config = getSurveysConfig();
  const surveyIndex = config.surveys.findIndex((s) => {
    const surveyHash = generateHashFromTitle(s.title);
    return surveyHash === hash;
  });

  if (surveyIndex === -1) {
    throw new Error("Survey not found");
  }

  const existingSurvey = config.surveys[surveyIndex];
  if (!existingSurvey) {
    throw new Error("Survey not found");
  }

  // If title is being updated, check for duplicates (excluding current survey)
  if (updates.title && updates.title !== existingSurvey.title) {
    if (
      config.surveys.some(
        (s, i) => i !== surveyIndex && s.title === updates.title,
      )
    ) {
      throw new Error("A survey with this title already exists");
    }
  }

  // Merge updates - handle undefined targetEmail to remove it
  const updatedSurvey: Survey = {
    ...existingSurvey,
    ...updates,
  };
  
  // If targetEmail is undefined, delete it from the object
  if ('targetEmail' in updates && updates.targetEmail === undefined) {
    delete updatedSurvey.targetEmail;
  }

  config.surveys[surveyIndex] = updatedSurvey;

  await saveSurveysConfig(config);
}

export async function deleteSurvey(hash: string): Promise<void> {
  const config = getSurveysConfig();
  const surveyIndex = config.surveys.findIndex((s) => {
    const surveyHash = generateHashFromTitle(s.title);
    return surveyHash === hash;
  });

  if (surveyIndex === -1) {
    throw new Error("Survey not found");
  }

  config.surveys.splice(surveyIndex, 1);
  await saveSurveysConfig(config);
}

export async function updateDefaultTargetEmail(
  email: string,
): Promise<void> {
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  const config = getSurveysConfig();
  config.defaultTargetEmail = email;
  await saveSurveysConfig(config);
}


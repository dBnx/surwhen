import { promises as fs } from "fs";
import { join } from "path";
import type {
  Survey,
  SurveysConfig,
} from "~/lib/surveys";
import {
  generateHashFromTitle,
  isValidEmail,
} from "~/lib/surveys";
import { getStorageBackend } from "~/lib/storage";

const STORAGE_KEY = "surveys.json";

// Initialize storage backend
const storage = getStorageBackend();

/**
 * Ensure the storage file exists. If it doesn't, try to copy from the original file,
 * or create a default config if the original doesn't exist.
 */
async function ensureStorageFileExists(): Promise<void> {
  const exists = await storage.exists(STORAGE_KEY);
  if (exists) {
    // File exists, nothing to do
    return;
  }

  // File doesn't exist, try to copy from original file
  const originalPath = join(process.cwd(), "surveys.json");
  try {
    const originalContent = await fs.readFile(originalPath, "utf-8");
    await storage.write(STORAGE_KEY, originalContent);
  } catch {
    // If original doesn't exist or can't be read, start with empty config
    const defaultConfig: SurveysConfig = {
      defaultTargetEmail: "",
      surveys: [],
      accentColor: undefined,
    };
    await storage.write(STORAGE_KEY, JSON.stringify(defaultConfig, null, 2));
  }
}

export async function saveSurveysConfig(
  config: SurveysConfig,
): Promise<void> {
  await ensureStorageFileExists();
  await storage.write(STORAGE_KEY, JSON.stringify(config, null, 2));
}

// New function to get config from the correct location
export async function getSurveysConfigFromFile(): Promise<SurveysConfig> {
  // Ensure storage file exists before reading (copy from original if needed)
  await ensureStorageFileExists();
  // Always read from storage backend (the runtime config)
  const content = await storage.read(STORAGE_KEY);
  return JSON.parse(content) as SurveysConfig;
}

// Async version of getSurveyByHash that reads from file
export async function getSurveyByHashFromFile(
  hash: string,
): Promise<Survey | null> {
  const config = await getSurveysConfigFromFile();
  
  for (const survey of config.surveys) {
    const surveyHash = generateHashFromTitle(survey.title);
    if (surveyHash === hash) {
      return survey;
    }
  }
  
  return null;
}

// Async version of getTargetEmail that reads from file
export async function getTargetEmailFromFile(survey: Survey): Promise<string> {
  const config = await getSurveysConfigFromFile();
  return survey.targetEmail ?? config.defaultTargetEmail;
}

export async function addSurvey(survey: Survey): Promise<void> {
  const config = await getSurveysConfigFromFile();

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
  const config = await getSurveysConfigFromFile();
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
  const config = await getSurveysConfigFromFile();
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

  const config = await getSurveysConfigFromFile();
  config.defaultTargetEmail = email;
  await saveSurveysConfig(config);
}

export async function updateAccentColor(
  color: string | null,
): Promise<void> {
  const config = await getSurveysConfigFromFile();
  if (color === null || color === "") {
    delete config.accentColor;
  } else {
    config.accentColor = color;
  }
  await saveSurveysConfig(config);
}

export async function mergeSurveysConfig(
  uploadedConfig: SurveysConfig,
  conflictPreference: "source" | "existing",
): Promise<SurveysConfig> {
  const existingConfig = await getSurveysConfigFromFile();
  
  // Create a map of existing surveys by title (hash)
  const existingSurveysMap = new Map<string, Survey>();
  for (const survey of existingConfig.surveys) {
    const hash = generateHashFromTitle(survey.title);
    existingSurveysMap.set(hash, survey);
  }
  
  // Process uploaded surveys
  const mergedSurveys: Survey[] = [...existingConfig.surveys];
  
  for (const uploadedSurvey of uploadedConfig.surveys) {
    const hash = generateHashFromTitle(uploadedSurvey.title);
    const existingSurvey = existingSurveysMap.get(hash);
    
    if (existingSurvey) {
      // Conflict: survey with same title exists
      if (conflictPreference === "source") {
        // Replace existing with uploaded
        const index = mergedSurveys.findIndex(
          (s) => generateHashFromTitle(s.title) === hash,
        );
        if (index !== -1) {
          mergedSurveys[index] = uploadedSurvey;
        }
      }
      // If conflictPreference === "existing", we keep the existing survey (already in mergedSurveys)
    } else {
      // No conflict, add the uploaded survey
      mergedSurveys.push(uploadedSurvey);
    }
  }
  
  // For merge, prefer uploaded defaultTargetEmail and accentColor if provided
  return {
    defaultTargetEmail: uploadedConfig.defaultTargetEmail || existingConfig.defaultTargetEmail,
    accentColor: uploadedConfig.accentColor ?? existingConfig.accentColor,
    surveys: mergedSurveys,
  };
}


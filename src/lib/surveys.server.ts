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

// Use /tmp for writes (writable in serverless environments)
// Read from /tmp if it exists, otherwise fall back to original file
async function getSurveysJsonPath(readOnly = false): Promise<string> {
  if (readOnly) {
    // For reading, check /tmp first, then fall back to original
    const tmpPath = "/tmp/surveys.json";
    try {
      await fs.access(tmpPath);
      return tmpPath;
    } catch {
      // /tmp version doesn't exist, use original
      return join(process.cwd(), "surveys.json");
    }
  }
  // For writing, always use /tmp
  return "/tmp/surveys.json";
}

async function ensureTmpFileExists(): Promise<void> {
  const tmpPath = "/tmp/surveys.json";
  try {
    await fs.access(tmpPath);
    // File exists, nothing to do
    return;
  } catch {
    // File doesn't exist, copy from original
    const originalPath = join(process.cwd(), "surveys.json");
    try {
      const originalContent = await fs.readFile(originalPath, "utf-8");
      await fs.writeFile(tmpPath, originalContent, "utf-8");
    } catch (error) {
      // If original doesn't exist or can't be read, start with empty config
      const defaultConfig: SurveysConfig = {
        defaultTargetEmail: "",
        surveys: [],
      };
      await fs.writeFile(tmpPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
    }
  }
}

export async function saveSurveysConfig(
  config: SurveysConfig,
): Promise<void> {
  await ensureTmpFileExists();
  const filePath = await getSurveysJsonPath(false);
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
}

// New function to get config from the correct location
export async function getSurveysConfigFromFile(): Promise<SurveysConfig> {
  const filePath = await getSurveysJsonPath(true);
  const content = await fs.readFile(filePath, "utf-8");
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


export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getSurveysConfig, generateHashFromTitle } = await import(
      "~/lib/surveys"
    );
    const { env } = await import("~/env");

    const config = getSurveysConfig();
    console.log("=== Survey Routes ===");
    config.surveys.forEach((survey) => {
      const hash = generateHashFromTitle(survey.title);
      console.log(`Survey: ${survey.title} -> /survey/${hash}`);
    });
    console.log(`Admin: /admin?token=${env.ADMIN_TOKEN}`);
    console.log("====================");
  }
}


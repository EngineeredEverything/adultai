import { readFileSync } from "fs";
import { join } from "path";
import { domain } from "../config";
import Handlebars from "handlebars";
Handlebars.registerHelper("eq", (a, b) => a === b);
import { logger } from "@/lib/logger";

const replaceTemplateVariables = (
  template: string,
  variables: Record<string, string>
) => {
  logger.info("Template before replacing variables:", template);
  logger.info("Variables to replace:", variables);
  const result = Object.entries(variables).reduce((result, [key, value]) => {
    logger.info(`Replacing {{${key}}} with ${value}`);
    return result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }, template);
  logger.info("Template after replacing variables:", result);
  return result;
};

// Function to compile a Handlebars template with variables
export const compileTemplate = (
  templatePath: string,
  variables: Record<string, any>
): string => {
  logger.info("Compiling template:", templatePath);
  const templateContent = loadTemplate(templatePath);

  // Compile the template with Handlebars
  const compiledTemplate = Handlebars.compile(templateContent);
  const result = compiledTemplate(variables);
  logger.info("Compiled template result:", result);

  return result;
};

// Function to load a template file as a string
export const loadTemplate = (templatePath: string): string => {
  logger.info("Loading template from path:", templatePath);
  const fullPath = join(process.cwd(), "lib/mail/templates/html", templatePath);
  logger.info("Full template path:", fullPath);

  // Read the template content from the correct path
  const templateContent = readFileSync(fullPath, "utf-8");
  logger.info("Loaded template content:", templateContent);

  return templateContent;
};

// Function to get the base template with inserted content
export const getBaseTemplate = (
  content: string,
): string => {
  logger.info("Content to insert:", content);

  // Load the base HTML template
  const baseTemplateContent = loadTemplate("base.html");
  const finalTemplate = replaceTemplateVariables(baseTemplateContent, {
    content,
    domain,
  });
  return finalTemplate;
};

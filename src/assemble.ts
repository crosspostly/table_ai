#!/usr/bin/env node

/**
 * Main assembly script for YouTube Podcast Generator
 * Creates videos from chapters with images and audio using FFmpeg
 */

import * as fs from 'fs';
import * as path from 'path';
import ChapterPackager from '../services/chapterPackager';

interface ChapterData {
  chapterNum: number;
  chapterDir: string;
  audioFile: string;
  imagesDir: string;
  metadataFile: string;
}

interface ProjectConfig {
  chapters: ChapterData[];
  outputDir: string;
  tempDir: string;
}

class VideoAssembler {
  private packager: ChapterPackager;
  private config: ProjectConfig;

  constructor(configPath: string = './project-config.json') {
    this.config = this.loadConfig(configPath);
    this.packager = new ChapterPackager(this.config.tempDir, this.config.outputDir);
  }

  private loadConfig(configPath: string): ProjectConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validate config structure
    if (!configData.chapters || !Array.isArray(configData.chapters)) {
      throw new Error('Invalid configuration: chapters array is required');
    }

    return {
      chapters: configData.chapters,
      outputDir: configData.outputDir || './output',
      tempDir: configData.tempDir || './temp'
    };
  }

  /**
   * Validate all chapters before processing
   */
  private validateChapters(): { valid: boolean; errors: string[] } {
    const allErrors: string[] = [];

    for (const chapter of this.config.chapters) {
      const chapterConfig = {
        chapterNum: chapter.chapterNum,
        chapterDir: chapter.chapterDir,
        audioFile: chapter.audioFile,
        imagesDir: chapter.imagesDir,
        metadataFile: chapter.metadataFile
      };

      const validation = this.packager.validateChapterMetadata(chapterConfig);
      if (!validation.valid) {
        allErrors.push(...validation.errors.map(err => `Chapter ${chapter.chapterNum}: ${err}`));
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Generate and save the assembly script
   */
  generateAssemblyScript(): string {
    console.log('🔧 Validating chapters...');
    const validation = this.validateChapters();
    
    if (!validation.valid) {
      console.error('❌ Validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

    console.log('✅ All chapters validated successfully');
    console.log('🎬 Generating assembly script...');

    const chapterConfigs = this.config.chapters.map(chapter => ({
      chapterNum: chapter.chapterNum,
      chapterDir: chapter.chapterDir,
      audioFile: chapter.audioFile,
      imagesDir: chapter.imagesDir,
      metadataFile: chapter.metadataFile
    }));

    const assemblyScript = this.packager.generateChapterBasedAssemblyScript(chapterConfigs);
    const scriptPath = this.packager.saveScript(assemblyScript.script);

    console.log(`✅ Assembly script generated: ${scriptPath}`);
    console.log(`📁 Temporary files: ${assemblyScript.tempFiles.length}`);
    
    return scriptPath;
  }

  /**
   * Execute the assembly script
   */
  async executeAssembly(scriptPath: string): Promise<void> {
    console.log('🚀 Starting video assembly...');
    
    try {
      const { execSync } = require('child_process');
      execSync(scriptPath, { stdio: 'inherit' });
      console.log('🎉 Video assembly completed successfully!');
    } catch (error) {
      console.error('❌ Video assembly failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Run the complete assembly process
   */
  async run(): Promise<void> {
    try {
      const scriptPath = this.generateAssemblyScript();
      await this.executeAssembly(scriptPath);
    } catch (error) {
      console.error('❌ Assembly process failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configPath = args[0] || './project-config.json';
  
  try {
    const assembler = new VideoAssembler(configPath);
    await assembler.run();
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export default VideoAssembler;
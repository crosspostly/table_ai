/**
 * Chapter Packager Service
 * Handles video chapter assembly using FFmpeg
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ChapterConfig {
  chapterNum: number;
  chapterDir: string;
  audioFile: string;
  imagesDir: string;
  metadataFile: string;
}

export interface AssemblyScript {
  script: string;
  tempFiles: string[];
}

export class ChapterPackager {
  private readonly tempDir: string;
  private readonly outputDir: string;

  constructor(tempDir: string = './temp', outputDir: string = './output') {
    this.tempDir = tempDir;
    this.outputDir = outputDir;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate chapter-based assembly script with FIXED concat file format
   * Main issue: Last image should NOT have duration line
   */
  generateChapterBasedAssemblyScript(chapters: ChapterConfig[]): AssemblyScript {
    const scriptLines: string[] = [];
    const tempFiles: string[] = [];

    // Script header
    scriptLines.push('@echo off');
    scriptLines.push('setlocal enabledelayedexpansion');
    scriptLines.push('chcp 65001 >nul');
    scriptLines.push('echo Starting video assembly process...');
    scriptLines.push('');

    // Check FFmpeg and FFprobe availability
    scriptLines.push('REM Check FFmpeg and FFprobe');
    scriptLines.push('where ffmpeg >nul 2>nul');
    scriptLines.push('if %errorlevel% neq 0 (');
    scriptLines.push('    echo [ERROR] FFmpeg not found! Install FFmpeg and add to PATH.');
    scriptLines.push('    goto :error');
    scriptLines.push(')');
    scriptLines.push('');
    scriptLines.push('where ffprobe >nul 2>nul');
    scriptLines.push('if %errorlevel% neq 0 (');
    scriptLines.push('    echo [ERROR] FFprobe not found! Install FFmpeg and add to PATH.');
    scriptLines.push('    goto :error');
    scriptLines.push(')');
    scriptLines.push('');

    // Create temp directories
    scriptLines.push('REM Create temp directories');
    scriptLines.push('if not exist "temp_videos" mkdir temp_videos');
    scriptLines.push('if not exist "temp_concat" mkdir temp_concat');
    scriptLines.push('');

    // Process each chapter
    for (const chapter of chapters) {
      const chapterScript = this.generateChapterScript(chapter);
      scriptLines.push(...chapterScript.lines);
      tempFiles.push(...chapterScript.tempFiles);
    }

    // Combine chapters
    scriptLines.push('REM Combine all chapters into final video');
    const concatListFile = this.createChapterConcatList(chapters);
    scriptLines.push(`ffmpeg -f concat -safe 0 -i "${concatListFile}" -c copy "${this.outputDir}/final_video.mp4"`);
    scriptLines.push('');
    scriptLines.push('echo Video assembly completed successfully!');
    scriptLines.push('goto :end');
    scriptLines.push('');
    scriptLines.push(':error');
    scriptLines.push('echo [ERROR] Video assembly failed!');
    scriptLines.push('exit /b 1');
    scriptLines.push('');
    scriptLines.push(':end');
    scriptLines.push('endlocal');

    return {
      script: scriptLines.join('\n'),
      tempFiles
    };
  }

  private generateChapterScript(chapter: ChapterConfig): { lines: string[]; tempFiles: string[] } {
    const lines: string[] = [];
    const tempFiles: string[] = [];
    const chapterNum = chapter.chapterNum;
    const chapterDir = chapter.chapterDir;

    lines.push(`REM Processing chapter ${chapterNum}`);
    lines.push(`set "chapter_num=${chapterNum}"`);
    lines.push(`set "chapter_dir=${chapterDir}"`);

    // Check if audio exists
    lines.push('REM Check if audio exists');
    lines.push(`if not exist "!chapter_dir!\\audio.wav" (`);
    lines.push(`    echo [ERROR] Audio file not found for chapter !chapter_num!`);
    lines.push(`    goto :skip_chapter_${chapterNum}`);
    lines.push(')');
    lines.push('');

    // Get audio duration with error handling
    lines.push('REM Get audio duration');
    lines.push(`for /f %%d in ('ffprobe -v error -show_entries format=duration -of default^=noprint_wrappers^=1:nokey^=1 "!chapter_dir!\\audio.wav"') do set "duration=%%d"`);
    lines.push('');
    lines.push(`if "!duration!"=="" (`);
    lines.push(`    echo [ERROR] Could not determine audio duration for chapter !chapter_num!`);
    lines.push(`    goto :skip_chapter_${chapterNum}`);
    lines.push(')');
    lines.push('');

    // FIXED: Count images first to avoid division by zero
    lines.push('REM First pass - count images');
    lines.push('set "total_images=0"');
    lines.push(`for %%f in ("!chapter_dir!\\images\\*.png" "!chapter_dir!\\images\\*.jpg") do (`);
    lines.push('    set /a total_images+=1');
    lines.push(')');
    lines.push('');

    // Check if there are any images
    lines.push(`if !total_images! equ 0 (`);
    lines.push(`    echo [ERROR] No images found for chapter !chapter_num!`);
    lines.push(`    goto :skip_chapter_${chapterNum}`);
    lines.push(')');
    lines.push('');

    // Calculate image duration with bounds checking
    lines.push('REM Calculate image duration');
    lines.push(`if !total_images! gtr 0 (`);
    lines.push(`    powershell -Command "$d = [math]::Round(!duration! / !total_images!, 2); if ($d -lt 2) { $d = 2 }; if ($d -gt 20) { $d = 20 }; Write-Output $d" > temp_img_dur.txt`);
    lines.push(`    set /p img_duration=<temp_img_dur.txt`);
    lines.push(`    del temp_img_dur.txt`);
    lines.push(`)`);
    lines.push('');

    // FIXED: Create concat file with CORRECT last image handling
    lines.push('REM Second pass - create concat file with proper duration handling');
    lines.push('set "image_index=0"');
    lines.push(`(for %%f in ("!chapter_dir!\\images\\*.png" "!chapter_dir!\\images\\*.jpg") do (`);
    lines.push(`    set /a image_index+=1`);
    lines.push(`    echo file '%%f'`);
    lines.push(`    if !image_index! lss !total_images! (`);
    lines.push(`        echo duration !img_duration!`);
    lines.push(`    )`);
    lines.push(`)) > temp_concat_!chapter_num!.txt`);
    lines.push('');

    // Create chapter video
    lines.push('REM Create chapter video');
    lines.push(`ffmpeg -f concat -safe 0 -i temp_concat_!chapter_num!.txt -i "!chapter_dir!\\audio.wav" -c:v libx264 -c:a aac -shortest "temp_videos/chapter_!chapter_num!.mp4"`);
    lines.push('');

    lines.push(`goto :chapter_done_${chapterNum}`);
    lines.push('');
    lines.push(`:skip_chapter_${chapterNum}`);
    lines.push(`echo [WARNING] Skipping chapter ${chapterNum} due to errors`);
    lines.push('');
    lines.push(`:chapter_done_${chapterNum}`);
    lines.push('');

    const concatFile = `temp_concat_${chapterNum}.txt`;
    tempFiles.push(concatFile);

    return { lines, tempFiles };
  }

  private createChapterConcatList(chapters: ChapterConfig[]): string {
    const concatListFile = path.join(this.tempDir, 'chapters_concat.txt');
    const lines: string[] = [];

    for (const chapter of chapters) {
      lines.push(`file 'temp_videos/chapter_${chapter.chapterNum}.mp4'`);
    }

    fs.writeFileSync(concatListFile, lines.join('\n'));
    return concatListFile;
  }

  /**
   * Clean subtitle text encoding issues
   */
  cleanSubtitleText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    return text
      .replace(/â€"/g, '—')
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/â€™/g, "'")
      .replace(/â€¦/g, '...')
      .replace(/â€"/g, '–')
      .trim();
  }

  /**
   * Validate chapter metadata
   */
  validateChapterMetadata(chapter: ChapterConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!fs.existsSync(chapter.chapterDir)) {
      errors.push(`Chapter directory does not exist: ${chapter.chapterDir}`);
    }

    const audioPath = path.join(chapter.chapterDir, chapter.audioFile);
    if (!fs.existsSync(audioPath)) {
      errors.push(`Audio file does not exist: ${audioPath}`);
    }

    const imagesDir = path.join(chapter.chapterDir, chapter.imagesDir);
    if (!fs.existsSync(imagesDir)) {
      errors.push(`Images directory does not exist: ${imagesDir}`);
    } else {
      const imageFiles = fs.readdirSync(imagesDir).filter(file => 
        file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
      );
      if (imageFiles.length === 0) {
        errors.push(`No image files found in: ${imagesDir}`);
      }
    }

    const metadataPath = path.join(chapter.chapterDir, chapter.metadataFile);
    if (!fs.existsSync(metadataPath)) {
      errors.push(`Metadata file does not exist: ${metadataPath}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Save assembly script to file
   */
  saveScript(script: string, filename: string = 'assemble_video.bat'): string {
    const scriptPath = path.join(process.cwd(), filename);
    fs.writeFileSync(scriptPath, script, { encoding: 'utf8' });
    return scriptPath;
  }
}

export default ChapterPackager;
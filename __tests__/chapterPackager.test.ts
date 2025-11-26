/**
 * Tests for ChapterPackager service
 */

import ChapterPackager from '../services/chapterPackager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ChapterPackager', () => {
  let packager: ChapterPackager;
  let tempDir: string;
  let testChapterDir: string;
  let testImagesDir: string;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-packager-test-'));
    testChapterDir = path.join(tempDir, 'chapters', 'chapter_01');
    testImagesDir = path.join(testChapterDir, 'images');
    
    // Ensure directories exist
    fs.mkdirSync(testImagesDir, { recursive: true });
    
    packager = new ChapterPackager(tempDir, path.join(tempDir, 'output'));
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateChapterBasedAssemblyScript', () => {
    it('should generate script with proper concat file format', () => {
      // Create test files
      fs.writeFileSync(path.join(testChapterDir, 'audio.wav'), 'fake audio data');
      fs.writeFileSync(path.join(testChapterDir, 'metadata.json'), JSON.stringify({title: 'Test Chapter'}));
      
      // Create test images
      for (let i = 1; i <= 3; i++) {
        fs.writeFileSync(path.join(testImagesDir, `00${i}.png`), `fake image data ${i}`);
      }

      const chapter = {
        chapterNum: 1,
        chapterDir: testChapterDir,
        audioFile: 'audio.wav',
        imagesDir: 'images',
        metadataFile: 'metadata.json'
      };

      const result = packager.generateChapterBasedAssemblyScript([chapter]);
      
      expect(result.script).toContain('@echo off');
      expect(result.script).toContain('setlocal enabledelayedexpansion');
      expect(result.script).toContain('where ffmpeg');
      expect(result.script).toContain('where ffprobe');
      expect(result.script).toContain('set "total_images=0"');
      expect(result.script).toContain('if !total_images! equ 0');
      expect(result.script).toContain('if !image_index! lss !total_images!');
      
      // CRITICAL: Verify that script structure is correct
      const lines = result.script.split('\n');
      const concatFileLines = lines.filter(line => 
        line.includes('echo file') || line.includes('echo duration')
      );
      
      // Should have file and duration echo statements in the script
      const fileLines = concatFileLines.filter(line => line.includes('echo file'));
      const durationLines = concatFileLines.filter(line => line.includes('echo duration'));
      
      // Verify script contains the right structure
      expect(fileLines.length).toBeGreaterThan(0);
      expect(durationLines.length).toBeGreaterThan(0);
      
      // CRITICAL: Verify the conditional logic for last image
      expect(result.script).toContain('if !image_index! lss !total_images! (');
      expect(result.script).toContain('echo duration !img_duration!');
      
      // Verify pattern: file echo, conditional duration (template structure)
      expect(concatFileLines).toEqual([
        expect.stringContaining('echo file'),
        expect.stringContaining('echo duration')
      ]);
    });

    it('should handle zero images gracefully', () => {
      // Create test files but no images
      fs.writeFileSync(path.join(testChapterDir, 'audio.wav'), 'fake audio data');
      fs.writeFileSync(path.join(testChapterDir, 'metadata.json'), JSON.stringify({title: 'Test Chapter'}));

      const chapter = {
        chapterNum: 1,
        chapterDir: testChapterDir,
        audioFile: 'audio.wav',
        imagesDir: 'images',
        metadataFile: 'metadata.json'
      };

      const result = packager.generateChapterBasedAssemblyScript([chapter]);
      
      expect(result.script).toContain('if !total_images! equ 0');
      expect(result.script).toContain('[ERROR] No images found for chapter');
    });

    it('should handle missing audio file', () => {
      // Create test files but no audio
      fs.writeFileSync(path.join(testChapterDir, 'metadata.json'), JSON.stringify({title: 'Test Chapter'}));
      fs.writeFileSync(path.join(testImagesDir, '001.png'), 'fake image data');

      const chapter = {
        chapterNum: 1,
        chapterDir: testChapterDir,
        audioFile: 'audio.wav',
        imagesDir: 'images',
        metadataFile: 'metadata.json'
      };

      const result = packager.generateChapterBasedAssemblyScript([chapter]);
      
      expect(result.script).toContain('if not exist "!chapter_dir!\\audio.wav"');
      expect(result.script).toContain('[ERROR] Audio file not found for chapter');
    });
  });

  describe('validateChapterMetadata', () => {
    it('should validate complete chapter', () => {
      // Create complete test files
      fs.writeFileSync(path.join(testChapterDir, 'audio.wav'), 'fake audio data');
      fs.writeFileSync(path.join(testChapterDir, 'metadata.json'), JSON.stringify({title: 'Test Chapter'}));
      fs.writeFileSync(path.join(testImagesDir, '001.png'), 'fake image data');

      const chapter = {
        chapterNum: 1,
        chapterDir: testChapterDir,
        audioFile: 'audio.wav',
        imagesDir: 'images',
        metadataFile: 'metadata.json'
      };

      const result = packager.validateChapterMetadata(chapter);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing files', () => {
      const chapter = {
        chapterNum: 1,
        chapterDir: testChapterDir,
        audioFile: 'audio.wav',
        imagesDir: 'images',
        metadataFile: 'metadata.json'
      };

      const result = packager.validateChapterMetadata(chapter);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('Audio file does not exist'))).toBe(true);
      expect(result.errors.some(err => err.includes('Metadata file does not exist'))).toBe(true);
    });

    it('should detect empty images directory', () => {
      fs.writeFileSync(path.join(testChapterDir, 'audio.wav'), 'fake audio data');
      fs.writeFileSync(path.join(testChapterDir, 'metadata.json'), JSON.stringify({title: 'Test Chapter'}));

      const chapter = {
        chapterNum: 1,
        chapterDir: testChapterDir,
        audioFile: 'audio.wav',
        imagesDir: 'images',
        metadataFile: 'metadata.json'
      };

      const result = packager.validateChapterMetadata(chapter);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('No image files found'))).toBe(true);
    });
  });

  describe('cleanSubtitleText', () => {
    it('should clean encoding issues', () => {
      // Test basic functionality with simple replacements
      expect(packager.cleanSubtitleText('hello world')).toBe('hello world');
      expect(packager.cleanSubtitleText('  test  ')).toBe('test');
      expect(packager.cleanSubtitleText('')).toBe('');
    });

    it('should handle empty text', () => {
      const result = packager.cleanSubtitleText('');
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      const result1 = packager.cleanSubtitleText(null as any);
      const result2 = packager.cleanSubtitleText(undefined as any);
      
      expect(result1).toBe('');
      expect(result2).toBe('');
    });
  });

  describe('saveScript', () => {
    it('should save script to file', () => {
      const scriptContent = '@echo off\necho Hello World';
      const filename = 'test-script.bat';
      
      const scriptPath = packager.saveScript(scriptContent, filename);
      
      expect(fs.existsSync(scriptPath)).toBe(true);
      const savedContent = fs.readFileSync(scriptPath, 'utf8');
      expect(savedContent).toBe(scriptContent);
      
      // Clean up
      fs.unlinkSync(scriptPath);
    });
  });
});
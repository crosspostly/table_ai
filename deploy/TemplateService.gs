/**
 * Template Service - DEPRECATED
 * 
 * ВНИМАНИЕ: Этот файл больше не используется!
 * Все функции для работы с шаблонами перенесены в CollectConfig.gs
 * и теперь работают с листом ConfigData вместо PropertiesService.
 * 
 * Этот файл оставлен для обратной совместимости, но будет удалён
 * в следующей версии.
 * 
 * Migration notes:
 * - getAllTemplates() → getAllTemplatesFromSheet() в CollectConfig.gs
 * - saveTemplate() → saveTemplateToSheet() в CollectConfig.gs  
 * - deleteTemplate() → deleteTemplateFromSheet() в CollectConfig.gs
 * 
 * @deprecated since v3.0.0
 * @see CollectConfig.gs
 */

console.log('TemplateService.gs is DEPRECATED. Use CollectConfig.gs functions instead.');
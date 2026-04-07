// /public/scripts/components/sidebarComponent.js
// Category sidebar management component

import { createElement, debounce } from '../utils/helpers.js';
import { stateService } from '../services/stateService.js';
import { premiumService } from '../services/premiumService.js';
import { dataService } from '../services/dataService.js';

export class SidebarComponent {
 constructor() {
 this.updateSidebarTimeout = null;
 this.debouncedUpdate = debounce(this.updateCategorySidebar.bind(this), 50);
 }

 /**
 * Initialize category sidebar
 */
 async initCategorySidebar() {
 const sidebarMenu = document.getElementById('category-sidebar-menu');
 if (!sidebarMenu) return;

 // Block re-renders during sidebar initialization
 stateService._blockRerender = true;
 // Wait for premium status to be stable
 await premiumService.waitForPremiumStatus();
 // Get target category from stats navigation
 const targetCategoryInfo = stateService.getStatsNavigationTarget();
 // Fetch categories
 const categoryData = await dataService.fetchAllCategoriesForMenu();
 this.buildSidebar(sidebarMenu, categoryData, targetCategoryInfo);
 // Clear the block flag
 stateService._blockRerender = false;
 // Listen for premium status changes to rebuild sidebar (fixes trial loading delay)
 // Remove any existing listener to avoid duplicates
 if (this._premiumStatusHandler) {
 window.removeEventListener('premiumStatusChanged', this._premiumStatusHandler);
 }
 this._premiumStatusHandler = () => {
 this.rebuildSidebar();
 };
 window.addEventListener('premiumStatusChanged', this._premiumStatusHandler);
 }

 /**
 * Rebuild sidebar when premium status changes
 */
 async rebuildSidebar() {
 const sidebarMenu = document.getElementById('category-sidebar-menu');
 if (!sidebarMenu) return;
 const categoryData = await dataService.fetchAllCategoriesForMenu();
 this.buildSidebar(sidebarMenu, categoryData, null);
 }

 /**
 * Build complete sidebar with sections
 */
 buildSidebar(sidebarMenu, categoryData, targetCategoryInfo) {
 sidebarMenu.innerHTML = '';
 const categorySections = [
 { title:"Greetings & Introductions", categories: categoryData.freeCategories, isPremium: false, source: 'free' },
 { title:"Numbers & Time", categories: categoryData.premium1Categories, isPremium: true, source: 'premium1' },
 { title:"Food & Dining", categories: categoryData.premium2Categories, isPremium: true, source: 'premium2' },
 { title:"Travel & Tourism", categories: categoryData.premium3Categories, isPremium: true, source: 'premium3' },
 { title:"Daily Life & Shopping", categories: categoryData.premium4Categories, isPremium: true, source: 'premium4' },
 { title:"Family & Relationships", categories: categoryData.premium5Categories, isPremium: true, source: 'premium5' },
 { title:"Health & Body", categories: categoryData.premium6Categories, isPremium: true, source: 'premium6' },
 { title:"Education & Work", categories: categoryData.premium7Categories, isPremium: true, source: 'premium7' },
 { title:"Hobbies & Interests", categories: categoryData.premium8Categories, isPremium: true, source: 'premium8' }
 ];

 // Create join container for all accordions
 const joinContainer = createElement('div', {
 parent: sidebarMenu,
 className: 'join join-vertical w-full'
 });

 let firstSection = null;
 let targetSection = null;

 categorySections.forEach(section => {
 if (section.categories.length === 0) return;
 const sectionElement = this.buildCategorySection(
 joinContainer, section.title, section.categories, section.isPremium
 );
 if (!firstSection && !section.isPremium) {
 firstSection = sectionElement;
 }

 // Find target section for stats navigation
 if (targetCategoryInfo && section.source === targetCategoryInfo.source) {
 targetSection = sectionElement;
 }
 });

 this.handleSidebarNavigation(targetCategoryInfo, targetSection, firstSection, categoryData);
 }

 /**
 * Build individual category section with DaisyUI accordion
 */
 buildCategorySection(parent, title, categories, isPremium = false) {
 const filteredCategories = categories.filter(
 (category) => category.name !=="Basic Questions - Phrases"
 );
 if (filteredCategories.length === 0) return;

 // Create accordion wrapper with join-item class
 const accordionDiv = createElement('div', {
 parent,
 className: 'collapse collapse-arrow join-item bg-learning-app-design-3'
 });

 // Create checkbox input for accordion (with id for label)
 const checkboxId = `accordion-${title.replace(/\s+/g, '-').toLowerCase()}`;
 const checkbox = createElement('input', {
 parent: accordionDiv,
 attributes: { type: 'checkbox',
 id: checkboxId
 }
 });

 // Create accordion title
 const accordionTitle = createElement('div', {
 parent: accordionDiv,
 className: 'collapse-title text-base font-semibold',
 text: title
 });

 // Create accordion content
 const accordionContent = createElement('div', {
 parent: accordionDiv,
 className: 'collapse-content'
 });

 // Create submenu list
 const subMenu = createElement('ul', {
 parent: accordionContent,
 className: 'menu menu-compact p-0'
 });

 filteredCategories.forEach(category => {
 // Use fresh premium status - CRITICAL: check multiple times to ensure correctness
 let currentPremiumStatus = premiumService.getPremiumStatus();
 // During stats navigation, double-check the status
 if (stateService._blockRerender) {
 currentPremiumStatus = window.isPremiumUser || premiumService.isPremiumUser || false;
 }
 const isLocked = isPremium && !currentPremiumStatus;

 const item = createElement('li', { parent: subMenu });
 const link = createElement('a', {
 parent: item,
 className: `text-sm py-2 px-4 rounded-lg hover:bg-learning-app-design-4 transition-colors ${
 stateService.categoryFilter === category.name ? 'bg-level-expert hover:bg-level-expert' : ''
 } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`,
 html: isLocked ? `
 <span class="flex items-center justify-between w-full">
 <span>${category.name}</span>
 <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
 </svg>
 </span>
 ` : category.name
 });
 link.setAttribute('data-category', category.name);

 link.addEventListener('click', (e) => {
 e.preventDefault();
 if (!isLocked) {
 stateService.categoryFilter = category.name;
 this.updateCategorySidebar();
 // Dispatch event for card rendering
 window.dispatchEvent(new CustomEvent('categoryChanged', { detail: { category: category.name } }));
 }
 });
 });
 return { accordionDiv, checkbox };
 }

 /**
 * Handle sidebar navigation logic
 */
 handleSidebarNavigation(targetCategoryInfo, targetSection, firstSection, categoryData) {
 if (targetCategoryInfo && targetSection) {
 targetSection.checkbox.checked = true;
 stateService.categoryFilter = targetCategoryInfo.category;
 setTimeout(() => {
 this.updateCategorySidebar();
 // Dispatch event for rendering
 window.dispatchEvent(new CustomEvent('categoryChanged', { detail: { category: targetCategoryInfo.category } }));
 }, 100);
 } else {
 // Default behavior
 if (firstSection) {
 if (!stateService.categoryFilter && categoryData.freeCategories.length > 0) {
 stateService.categoryFilter = categoryData.freeCategories[0].name;
 this.updateCategorySidebar();
 }
 }
 }
 }

 /**
 * Update category sidebar active states
 */
 updateCategorySidebar() {
 // Simplified debouncing
 if (this.updateSidebarTimeout) {
 clearTimeout(this.updateSidebarTimeout);
 }
 this.updateSidebarTimeout = setTimeout(() => {
 let activeCategoryFound = false;
 document.querySelectorAll('#category-sidebar-menu a').forEach(link => {
 let categoryName = link.getAttribute('data-category') || link.textContent.trim();
 // Handle premium categories with icons
 const spanElement = link.querySelector('span');
 if (spanElement) {
 const clonedSpan = spanElement.cloneNode(true);
 const svg = clonedSpan.querySelector('svg');
 if (svg) svg.remove();
 categoryName = clonedSpan.textContent.trim();
 }
 const isActive = categoryName === stateService.categoryFilter;
 // Update classes for active state
 if (isActive) {
 link.className = 'text-sm py-2 px-4 rounded-lg transition-colors bg-level-expert hover:bg-level-expert';
 activeCategoryFound = true;
 } else {
 // Check if locked
 const isLocked = link.querySelector('svg');
 link.className = `text-sm py-2 px-4 rounded-lg hover:bg-learning-app-design-4 transition-colors ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`;
 }
 });
 }, 50);
 }
}

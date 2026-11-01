const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  path.join(__dirname, 'src', 'App.tsx'),
  path.join(__dirname, 'src', 'components', 'RoleWorkspaceView.tsx'),
  path.join(__dirname, 'src', 'components', 'ComparatorView.tsx'),
  path.join(__dirname, 'src', 'components', 'AIChatAssistant.tsx'),
  path.join(__dirname, 'src', 'components', 'AuthProfileModal.tsx'),
  path.join(__dirname, 'src', 'components', 'PropertyDetailModal.tsx'),
  path.join(__dirname, 'src', 'components', 'PropertyFormModal.tsx'),
  path.join(__dirname, 'src', 'components', 'ContractRegistrationModal.tsx'),
  path.join(__dirname, 'src', 'components', 'CounterOfferModal.tsx'),
];

for (const filePath of filesToUpdate) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace olive/green classes with Azul petróleo #173B43
  content = content.replace(/bg-\[#4A5443\]/g, 'bg-[#173B43]');
  content = content.replace(/hover:bg-\[#3B4435\]/g, 'hover:bg-[#122e35]');
  content = content.replace(/border-\[#4A5443\]/g, 'border-[#173B43]');
  content = content.replace(/text-\[#4A5443\]/g, 'text-[#173B43]');
  content = content.replace(/focus:border-\[#4A5443\]/g, 'focus:border-[#173B43]');
  content = content.replace(/hover:bg-\[#4A5443\]/g, 'hover:bg-[#173B43]');

  // Replace cream #F4EFE6 with Blanco cálido #F8F6F1
  content = content.replace(/bg-\[#F4EFE6\]/g, 'bg-[#F8F6F1]');

  // Replace sand #D6CBB8 / #C5B79F with Champagne #D5BFA0
  content = content.replace(/border-\[#D6CBB8\]/g, 'border-[#D5BFA0]');
  content = content.replace(/border-\[#C5B79F\]/g, 'border-[#D5BFA0]');

  // Replace charcoal #2B2B2B with Gris carbón #303638
  content = content.replace(/text-\[#2B2B2B\]/g, 'text-[#303638]');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated colors in:', filePath);
}

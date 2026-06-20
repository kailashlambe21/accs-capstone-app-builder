'use strict';

const extensionId = 'badge_management';
const menuSectionId = `${extensionId}::apps`;
const menuItemId = `${extensionId}::main`;

/**
 * Admin UI SDK: menu shape returned when Commerce refreshes registrations.
 * Keep in sync with `adminUiSdk.registration` in `app.commerce.config.js`.
 *
 * Platform limit: one section + one menu per app; use in-app tabs for multiple views.
 */
async function main () {
  return {
    statusCode: 200,
    body: {
      registration: {
        menuItems: [
          {
            id: menuSectionId,
            title: 'Badge Management',
            isSection: true,
            sortOrder: 100,
          },
          {
            id: menuItemId,
            title: 'Badge Management',
            parent: menuSectionId,
            sortOrder: 1,
          },
        ],
        page: {
          title: 'Badge Management',
        },
      },
    },
  };
}

exports.main = main;

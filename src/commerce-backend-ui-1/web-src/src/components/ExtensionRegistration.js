import { register } from '@adobe/uix-guest';
import { useEffect } from 'react';

import BadgeManagementPage from './BadgeManagementPage';
import { extensionId } from './Constants';

/**
 * Match working Stage2 pattern: register in background, page handles attach once.
 * @see accs-cohort-app-builder-v1 ExtensionRegistration.js
 */
export default function ExtensionRegistration () {
  useEffect(() => {
    (async () => {
      await register({
        id: extensionId,
        methods: {},
      });
    })();
  }, []);

  return <BadgeManagementPage />;
}

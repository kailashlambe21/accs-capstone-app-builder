import React, { useEffect, useState } from 'react';
import { attach } from '@adobe/uix-guest';
import {
  Provider,
  defaultTheme,
  View,
  Tabs,
  TabList,
  Item,
  Flex,
  ProgressCircle,
  Text,
  Well,
} from '@adobe/react-spectrum';
import BadgeRulesPage from './BadgeRulesPage';
import BadgeAssignmentsPage from './BadgeAssignmentsPage';
import { extensionId } from './Constants';

/**
 * Single attach() for IMS credentials, then lazy tab rendering.
 * Matches Stage2 MainPage + Adobe custom-menu sample pattern.
 */
export default function BadgeManagementPage () {
  const [selectedTab, setSelectedTab] = useState('rules');
  const [ims, setIms] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const guestConnection = await attach({ id: extensionId });
        if (!mounted) return;
        setIms({
          token: guestConnection.sharedContext.get('imsToken'),
          org: guestConnection.sharedContext.get('imsOrgId'),
        });
      } catch (err) {
        if (mounted) setError(err.message || String(err));
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-400">
          <Well><Text>Error: {error}</Text></Well>
        </View>
      </Provider>
    );
  }

  if (!ims?.token) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-400">
          <Flex alignItems="center" gap="size-200">
            <ProgressCircle aria-label="Loading" isIndeterminate />
            <Text>Loading badge management…</Text>
          </Flex>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Tabs
          aria-label="Badge Management"
          selectedKey={selectedTab}
          onSelectionChange={setSelectedTab}
        >
          <TabList>
            <Item key="rules">Badge Rules</Item>
            <Item key="assignments">Badge Assignments</Item>
          </TabList>
        </Tabs>

        <View marginTop="size-200">
          {selectedTab === 'rules' && (
            <BadgeRulesPage embedded ims={ims} />
          )}
          {selectedTab === 'assignments' && (
            <BadgeAssignmentsPage embedded ims={ims} />
          )}
        </View>
      </View>
    </Provider>
  );
}

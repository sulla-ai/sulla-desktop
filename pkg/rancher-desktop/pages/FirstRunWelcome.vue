<template>
  <div class="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800">
    <form @submit.prevent="handleNext">
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Create Your Account</h2>
      <p class="mb-6 text-gray-600 dark:text-gray-400">Set up your account details and preferences.</p>

      <rd-fieldset legend-text="User Account" class="mb-6">
        <div class="mb-4">
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email:</label>
          <input id="email" type="email" v-model="settings!.experimental.sullaEmail" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Enter email">
        </div>
        <div class="mb-4">
          <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password:</label>
          <input id="password" type="password" v-model="settings!.experimental.sullaPassword" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Enter password">
        </div>
      </rd-fieldset>

      <rd-fieldset legend-text="Updates" class="mb-6">
        <label class="flex items-center">
          <input type="checkbox" checked="true" v-model="settings!.experimental.sullaSubscribeToUpdates" class="mr-2">
          <span class="text-sm text-gray-700 dark:text-gray-300">Subscribe to updates and newsletters</span>
        </label>
      </rd-fieldset>

      <div class="flex justify-end">
        <button type="submit" class="px-6 py-2 text-white rounded-md transition-colors font-medium hover:opacity-90" :style="{ backgroundColor: '#30a5e9' }" :disabled="!isEmailValid || !settings!.experimental.sullaPassword?.trim()">Next</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, computed } from 'vue';
import { Ref } from 'vue';
import { Settings } from '@pkg/config/settings';
import { RecursivePartial } from '@pkg/utils/typeUtils';
import RdFieldset from '@pkg/components/form/RdFieldset.vue';
import { ipcRenderer } from 'electron';

const settings = inject<Ref<Settings>>('settings')!;
const commitChanges = inject<(settings: RecursivePartial<Settings>) => Promise<void>>('commitChanges')!;
const emit = defineEmits<{
  next: [];
}>();

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isEmailValid = computed(() => {
  const email = settings.value.experimental.sullaEmail?.trim();
  return email && emailRegex.test(email);
});

// Load settings on mount
onMounted(() => {
  // Default to subscribed
  ipcRenderer.invoke('settings-read' as any).then((loadedSettings: Settings) => {
    settings.value = loadedSettings;
    // Initialize credentials if not set
    settings.value.experimental.sullaEmail = settings.value.experimental.sullaEmail || '';
    settings.value.experimental.sullaPassword = settings.value.experimental.sullaPassword || '';
    // Keep subscribe default to true if not explicitly set
    settings.value.experimental.sullaSubscribeToUpdates = settings.value.experimental.sullaSubscribeToUpdates ?? true;
  });
});

const generatePassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  const all = uppercase + lowercase + digits;
  for (let i = 0; i < 5; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const generateEncryptionKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
};

const handleNext = async () => {
  // Generate and set service password and encryption key
  console.log('[FirstRunWelcome] Generating service password and encryption key...');
  settings.value.experimental.sullaServicePassword = generatePassword();
  settings.value.experimental.sullaN8nEncryptionKey = generateEncryptionKey();
  console.log('[FirstRunWelcome] Generated password:', settings.value.experimental.sullaServicePassword);
  console.log('[FirstRunWelcome] Generated encryption key:', settings.value.experimental.sullaN8nEncryptionKey);

  // Save the settings
  await commitChanges({
    experimental: {
      sullaEmail: settings.value.experimental.sullaEmail,
      sullaPassword: settings.value.experimental.sullaPassword,
      sullaServicePassword: settings.value.experimental.sullaServicePassword,
      sullaN8nEncryptionKey: settings.value.experimental.sullaN8nEncryptionKey,
      sullaSubscribeToUpdates: settings.value.experimental.sullaSubscribeToUpdates,
    },
    application: {
      firstRunCredentialsNeeded: false,
    }
  });
  console.log('[FirstRunWelcome] Settings committed successfully');

  // Check if ready to trigger custom environment
  if (settings.value.experimental.firstRunSullaNetworking &&
      settings.value.experimental.sullaEmail &&
      settings.value.experimental.sullaPassword &&
      settings.value.experimental.sullaServicePassword &&
      settings.value.experimental.sullaN8nEncryptionKey) {
    console.log('[FirstRunWelcome] Triggering custom environment...');
    await ipcRenderer.invoke('start-sulla-custom-env');
  } else {
    console.log('[FirstRunWelcome] Not ready to trigger custom environment yet');
    console.log('[FirstRunWelcome] firstRunSullaNetworking:', settings.value.experimental.firstRunSullaNetworking);
    console.log('[FirstRunWelcome] sullaEmail:', settings.value.experimental.sullaEmail);
    console.log('[FirstRunWelcome] sullaPassword:', settings.value.experimental.sullaPassword);
    console.log('[FirstRunWelcome] sullaServicePassword:', settings.value.experimental.sullaServicePassword);
    console.log('[FirstRunWelcome] sullaN8nEncryptionKey:', settings.value.experimental.sullaN8nEncryptionKey);
  }

  emit('next');
};
</script>

<style lang="scss" scoped>
.button-area {
  align-self: flex-end;
  margin-top: 1.5rem;
}

input[type="checkbox"]:checked {
  accent-color: #30a5e9;
}

/* Hover effects */
button:hover {
  cursor: pointer;
}

input:hover, select:hover {
  border-color: #374151; /* darker gray border */
  background-color: #f3f4f6; /* slightly darker background */
}
</style>

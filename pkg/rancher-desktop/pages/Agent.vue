<template>
  <div class="h-screen overflow-hidden bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <PostHogTracker page-name="Agent" />
    <div class="flex h-screen flex-col">

      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

    <!-- Loading overlay while system boots -->
    <StartupOverlay
      @overlay-visible="showOverlay = $event"
      @system-ready="systemReady = $event"
    />

    <!-- Main agent interface -->
    <div ref="chatScrollContainer" id="chat-scroll-container" class="flex min-h-0 flex-1 overflow-y-auto" :class="{ 'blur-sm pointer-events-none select-none': showOverlay }">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          v-if="hasMessages"
          class="relative mx-auto flex w-full flex-1 "
          :class="isAssetPaneExpanded ? 'max-w-none justify-start' : 'max-w-8xl xl:px-12 sm:px-2 lg:px-8 justify-center'"
        >
          <div v-if="!isAssetPaneExpanded" class="hidden lg:relative lg:block lg:flex-none lg:w-72 xl:w-80 bg-slate-50 dark:bg-slate-800/30">
            <div class="sticky top-[15px] pt-[15px] h-[calc(100vh-5rem-15px)] w-full overflow-x-hidden overflow-y-auto">

              <AgentPersonaLibrary/>

            </div>
          </div>

          <div
            class="min-w-0 py-16"
            :class="isAssetPaneExpanded
              ? 'flex-[0_0_30%] px-4 lg:pr-2 lg:pl-4 xl:px-6'
              : 'max-w-2xl flex-auto px-4 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16'"
          >
            <div ref="transcriptEl" id="chat-messages-list" class="pb-40">
              <div
                v-for="m in displayMessages"
                :key="m.id"
                class="mb-8"
              >
                <div v-if="m.role === 'user'" class="flex justify-end">
                  <div class="max-w-[min(760px,92%)] rounded-3xl p-6 bg-sky-50 dark:bg-slate-800/60 dark:ring-1 dark:ring-slate-300/10">
                    <div class="whitespace-pre-wrap text-sky-900 dark:text-slate-100">{{ m.content }}</div>
                  </div>
                </div>

                <div v-else-if="m.kind === 'tool'" class="max-w-[min(760px,92%)]">
                  <div v-if="m.toolCard" class="rounded border border-slate-200 bg-slate-900 px-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <button
                      type="button"
                      class="w-full px-4 py-2 flex items-center justify-between transition-colors"
                      @click="toggleToolCard(m.id)"
                    >
                      <div class="flex items-center gap-2">
                        <span class="font-mono token comment">{{ m.toolCard.toolName }}</span>
                        <span
                          class="rounded-full px-2 py-0.5 text-xs font-medium"
                          :class="m.toolCard.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : m.toolCard.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'"
                        >
                          {{ m.toolCard.status }}
                        </span>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 15 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        class="text-slate-500 transition-transform"
                        :class="isToolCardExpanded(m.id) ? 'rotate-180' : ''"
                      >
                        <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/>
                      </svg>
                    </button>
                    <div v-show="isToolCardExpanded(m.id)" class="px-4 pb-3">
                      <div v-if="m.toolCard.args && Object.keys(m.toolCard.args).length > 0" class="mb-2">
                        <div class="text-xs font-semibold text-slate-600 dark:text-slate-400">Arguments:</div>
                        <pre class="mt-1 overflow-x-auto rounded bg-slate-800 p-2 text-xs text-slate-400 dark:bg-slate-900/50"><code>{{ JSON.stringify(m.toolCard.args, null, 2) }}</code></pre>
                      </div>
                      <div v-if="m.toolCard.result !== undefined" class="mb-2">
                        <div class="text-xs font-semibold text-slate-600 dark:text-slate-400">Result:</div>
                        <pre class="mt-1 overflow-x-auto rounded bg-slate-800 p-2 text-xs text-slate-400 dark:bg-slate-900/50"><code>{{ typeof m.toolCard.result === 'string' ? m.toolCard.result : JSON.stringify(m.toolCard.result, null, 2) }}</code></pre>
                      </div>
                      <div v-if="m.toolCard.error" class="text-xs text-red-600 dark:text-red-400">
                        Error: {{ m.toolCard.error }}
                      </div>
                    </div>
                  </div>
                  <pre v-else class="prism-code language-shell"><code><span class="token plain">{{ m.content }}</span>
 </code></pre>
                </div>

                <div v-else class="max-w-[min(760px,92%)]">
                  <div v-if="m.image" class="space-y-2">
                    <img
                      :src="m.image.dataUrl"
                      :alt="m.image.alt || ''"
                      class="block h-auto max-w-full rounded-xl border border-black/10 dark:border-white/10"
                    >
                    <div v-if="m.image.alt" class="text-xs text-[#0d0d0d]/60 dark:text-white/60">
                      {{ m.image.alt }}
                    </div>
                  </div>
                  <div v-else class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert" v-html="renderMarkdown(m.content)" />
                </div>
              </div>
              <div
                v-if="loading"
                class="mb-3 flex justify-start"
              >
                <div class="relative max-w-[min(760px,92%)] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6 text-neutral-900 dark:text-neutral-100">
                  <div class="absolute -inset-px rounded-xl border-2 border-transparent [background:linear-gradient(var(--quick-links-hover-bg,var(--color-sky-50)),var(--quick-links-hover-bg,var(--color-sky-50)))_padding-box,linear-gradient(to_top,var(--color-indigo-400),var(--color-cyan-400),var(--color-sky-500))_border-box] dark:[--quick-links-hover-bg:var(--color-slate-800)]"></div>
                  <div class="relative">Thinking...</div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="hidden xl:sticky xl:top-0 xl:block xl:max-h-[calc(100vh-1rem-10rem)]"
            :class="isAssetPaneExpanded ? 'xl:flex-[0_0_70%] xl:overflow-hidden' : 'xl:flex-none xl:overflow-y-auto'"
            @wheel="handleAssetPaneScrollLock"
            @touchmove="handleAssetPaneScrollLock"
          >
            <div :class="isAssetPaneExpanded ? 'h-full w-full' : 'w-72'">
              <div v-if="latestChatError" class="my-8 flex rounded-3xl p-6 bg-amber-50 dark:bg-slate-800/60 dark:ring-1 dark:ring-slate-300/10">
                <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" class="h-8 w-8 flex-none [--icon-foreground:var(--color-amber-900)] [--icon-background:var(--color-amber-100)]">
                  <defs>
                    <radialGradient cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" id="_ChatWarn-gradient" gradientTransform="rotate(65.924 1.519 20.92) scale(25.7391)">
                      <stop stop-color="#FDE68A" offset=".08"></stop>
                      <stop stop-color="#F59E0B" offset=".837"></stop>
                    </radialGradient>
                    <radialGradient cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" id="_ChatWarn-gradient-dark" gradientTransform="matrix(0 24.5 -24.5 0 16 5.5)">
                      <stop stop-color="#FDE68A" offset=".08"></stop>
                      <stop stop-color="#F59E0B" offset=".837"></stop>
                    </radialGradient>
                  </defs>
                  <g class="dark:hidden">
                    <circle cx="20" cy="20" r="12" fill="url(#_ChatWarn-gradient)"></circle>
                    <path d="M3 16c0 7.18 5.82 13 13 13s13-5.82 13-13S23.18 3 16 3 3 8.82 3 16Z" fill-opacity="0.5" class="fill-(--icon-background) stroke-(--icon-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="m15.408 16.509-1.04-5.543a1.66 1.66 0 1 1 3.263 0l-1.039 5.543a.602.602 0 0 1-1.184 0Z" class="fill-(--icon-foreground) stroke-(--icon-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M16 23a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill-opacity="0.5" stroke="currentColor" class="fill-(--icon-background) stroke-(--icon-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                  </g>
                  <g class="hidden dark:inline">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M2 16C2 8.268 8.268 2 16 2s14 6.268 14 14-6.268 14-14 14S2 23.732 2 16Zm11.386-4.85a2.66 2.66 0 1 1 5.228 0l-1.039 5.543a1.602 1.602 0 0 1-3.15 0l-1.04-5.543ZM16 20a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="url(#_ChatWarn-gradient-dark)"></path>
                  </g>
                </svg>
                <div class="ml-4 flex-auto">
                  <p class="not-prose font-display text-xl text-amber-900 dark:text-amber-500">Oh no! Something bad happened!</p>
                  <div class="prose mt-2.5 text-amber-800 [--tw-prose-underline:var(--color-amber-400)] [--tw-prose-background:var(--color-amber-50)] prose-a:text-amber-900 prose-code:text-amber-900 dark:text-slate-300 dark:[--tw-prose-underline:var(--color-sky-700)] dark:prose-code:text-slate-300">
                    <p>{{ latestChatError }}</p>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-2" :class="isAssetPaneExpanded ? 'h-full min-h-0 pb-2' : ''">
                <AgentPersonaAssetCard
                  v-for="asset in visiblePersonaAssets"
                  :key="asset.id"
                  :asset="asset"
                  :asset-size="getAssetSize(asset.id)"
                  :is-active="assetIsActive(asset)"
                  :sanitize-asset-html="sanitizeAssetHtml"
                  :thread-id="currentThreadId || undefined"
                  @toggle-size="cycleAssetSize(asset.id)"
                  @document-format="applyDocumentFormat"
                  @document-input="onDocumentAssetInput"
                />
              </div>
            </div>
            </div>
          </div>

          <div
            :class="hasMessages ? 'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/80 pt-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80' : 'flex flex-1 items-center justify-center bg-white dark:bg-slate-900'"
          >
            <div v-if="hasMessages" class="relative mx-auto flex w-full max-w-8xl justify-center sm:px-2 lg:px-8 xl:px-12">
              <div class="max-w-2xl min-w-0 flex-auto px-4 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
                <div class="pb-3">
                  <div class="flex h-full flex-col items-center">
                    <form
                      class="group/composer mx-auto mb-3 w-full"
                      :data-empty="!query.trim()"
                      :data-running="loading"
                      @submit.prevent
                    >
                      <div class="relative overflow-visible rounded-lg bg-white/95 shadow-sm ring-1 ring-slate-200 transition-shadow focus-within:ring-slate-300 dark:bg-slate-800/75 dark:ring-white/5 dark:ring-inset dark:focus-within:ring-white/20">
                        <div class="absolute -top-px right-11 left-20 h-[2px] bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"></div>
                        <div class="absolute right-20 -bottom-px left-11 h-[2px] bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0"></div>
                        <div class="flex flex-wrap items-end gap-1 p-2">
                          <button
                            type="button"
                            class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                            aria-label="Attach"
                            :disabled="showOverlay"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
                            </svg>
                          </button>

                          <textarea
                            ref="composerTextareaEl"
                            v-model="query"
                            name="input"
                            placeholder="What do you want to know?"
                            class="my-2 h-6 max-h-[400px] min-w-0 flex-1 resize-none bg-transparent text-[#0d0d0d] text-base leading-6 outline-none placeholder:text-[#9a9a9a] dark:text-white dark:placeholder:text-neutral-500"
                            :class="isComposerMultiline ? 'basis-full order-2' : 'order-2'"
                            @input="updateComposerLayout"
                            @keydown.enter.exact.prevent="send"
                          />

                          <div
                            class="mb-0.5 flex items-center gap-2"
                            :class="isComposerMultiline ? 'order-3 w-full justify-between' : 'order-3'"
                          >
                            <div class="relative mb-0.5" ref="modelSelector.modelMenuEl">
                            <button
                              type="button"
                              ref="modelSelector.buttonRef"
                              class="flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[#0d0d0d] hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                              aria-label="Model select"
                              :disabled="showOverlay"
                              @click="handleModelSwitcherClick"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                                <path d="M12 8V4" />
                                <path d="M8 4h8" />
                                <rect x="6" y="8" width="12" height="10" rx="2" />
                                <path d="M9 18v2" />
                                <path d="M15 18v2" />
                                <path d="M9.5 12h.01" />
                                <path d="M14.5 12h.01" />
                                <path d="M10 15h4" />
                              </svg>
                              <div class="flex items-center gap-1 overflow-hidden">
                                <span class="whitespace-nowrap font-semibold text-sm">{{ modelSelector.activeModelLabelValue }}</span>
                                <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0" aria-hidden="true">
                                  <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                                </svg>
                              </div>
                            </button>

                            <div
                              v-if="modelSelector.showModelMenuValue"
                              class="agent-model-selector-menu absolute bottom-12 right-0 z-[9999] w-72 overflow-visible rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
                            >
                            <div class="flex items-center justify-between px-3 py-2">
                              <div class="text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                                Local
                              </div>
                              <button
                                type="button"
                                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#0d0d0d]/60 hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                                @click="modelSelector.hideModelMenu"
                                aria-label="Close model selector"
                              >
                                <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
                                  <path d="M11.7816 4.03157C12.0724 3.74081 12.0724 3.25991 11.7816 2.96915C11.4909 2.67839 11.0099 2.67839 10.7192 2.96915L7.50005 6.18827L4.28091 2.96915C3.99015 2.67839 3.50925 2.67839 3.21849 2.96915C2.92773 3.25991 2.92773 3.74081 3.21849 4.03157L6.43761 7.25071L3.21849 10.4698C2.92773 10.7606 2.92773 11.2415 3.21849 11.5323C3.50925 11.823 3.99015 11.823 4.28091 11.5323L7.50005 8.31315L10.7192 11.5323C11.0099 11.823 11.4909 11.823 11.7816 11.5323C12.0724 11.2415 12.0724 10.7606 11.7816 10.4698L8.56248 7.25071L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                                </svg>
                              </button>
                            </div>

                            <div v-if="modelSelector.loadingLocalModelsValue" class="px-3 py-2 text-sm text-[#0d0d0d]/70 dark:text-white/70">
                              Loading...
                            </div>
                            <button
                              v-for="m in modelSelector.localModelOptionsValue"
                              :key="m.value"
                              type="button"
                              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0d0d0d] hover:bg-[#f4f4f4] dark:text-white dark:hover:bg-white/10"
                              @click="modelSelector.selectModel(m)"
                            >
                              <span class="min-w-0 flex-1 truncate">{{ m.label }}</span>
                              <span v-if="m.isActive" class="shrink-0 text-xs font-semibold text-[#0d0d0d]/60 dark:text-white/60">Active</span>
                            </button>

                            <div class="border-t border-black/10 dark:border-white/10" />

                            <div class="px-3 py-2 text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                              Remote
                            </div>
                            <div v-if="!modelSelector.remoteOptionValue" class="px-3 py-2 text-sm text-[#0d0d0d]/70 dark:text-white/70">
                              No validated remote provider
                            </div>
                            <button
                              v-else
                              type="button"
                              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0d0d0d] hover:bg-[#f4f4f4] dark:text-white dark:hover:bg-white/10"
                              @click="modelSelector.remoteOptionValue && modelSelector.selectModel(modelSelector.remoteOptionValue)"
                            >
                              <span class="min-w-0 flex-1 truncate">{{ modelSelector.remoteOptionValue?.label }}</span>
                              <span v-if="modelSelector.remoteOptionValue?.isActive" class="shrink-0 text-xs font-semibold text-[#0d0d0d]/60 dark:text-white/60">Active</span>
                            </button>
                            </div>
                          </div>

                          <div class="flex items-center gap-2">
                            <!-- Send button - always visible when there's content -->
                            <button
                              v-if="query.trim()"
                              type="button"
                              class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer dark:bg-white dark:text-[#0d0d0d]"
                              aria-label="Send"
                              :disabled="showOverlay"
                              @click="send"
                            >
                              <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                              </svg>
                            </button>

                            <!-- Stop button - only visible when chat interface exists and graph is running -->
                            <button
                              v-if="hasMessages && graphRunning"
                              type="button"
                              class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer dark:bg-red-500 dark:text-white"
                              aria-label="Stop"
                              :disabled="showOverlay"
                              @click="stop"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
                              </svg>
                            </button>

                            <!-- Voice button - shown when no content and not running -->
                            <button
                              v-if="!query.trim() && !graphRunning"
                              type="button"
                              class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer dark:bg-white dark:text-[#0d0d0d]"
                              aria-label="Voice"
                              :disabled="showOverlay"
                              @click="handlePrimaryAction"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M12 19v3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="w-full px-4">
            <div class="flex h-full flex-col items-center justify-center">
              <form
                class="group/composer mx-auto mb-3 w-full max-w-3xl"
                :data-empty="!query.trim()"
                :data-running="loading"
                @submit.prevent
              >
                <div class="relative overflow-visible rounded-lg bg-white/95 shadow-sm ring-1 ring-slate-200 transition-shadow focus-within:ring-slate-300 dark:bg-slate-800/75 dark:ring-white/5 dark:ring-inset dark:focus-within:ring-white/20 z-10">
                  <div class="absolute -top-px right-11 left-20 h-[2px] bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"></div>
                  <div class="absolute right-20 -bottom-px left-11 h-[2px] bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0"></div>
                  <div class="flex flex-wrap items-end gap-1 p-2">
                    <button
                      type="button"
                      class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                      aria-label="Attach"
                      :disabled="showOverlay"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
                      </svg>
                    </button>

                    <textarea
                      ref="composerTextareaEl"
                      v-model="query"
                      name="input"
                      placeholder="What do you want to know?"
                      class="my-2 h-6 max-h-[400px] min-w-0 flex-1 resize-none bg-transparent text-[#0d0d0d] text-base leading-6 outline-none placeholder:text-[#9a9a9a] dark:text-white dark:placeholder:text-neutral-500"
                      :class="isComposerMultiline ? 'basis-full order-2' : 'order-2'"
                      @input="updateComposerLayout"
                      @keydown.enter.exact.prevent="send"
                    />

                    <div
                      class="mb-0.5 flex items-center gap-2"
                      :class="isComposerMultiline ? 'order-3 w-full justify-between' : 'order-3'"
                    >
                      <div class="relative mb-0.5" ref="modelSelector.modelMenuEl">
                        <button
                          type="button"
                          class="flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[#0d0d0d] hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                          aria-label="Model select"
                          :disabled="showOverlay"
                          @click="modelSelector.toggleModelMenu"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                            <path d="M12 8V4" />
                            <path d="M8 4h8" />
                            <rect x="6" y="8" width="12" height="10" rx="2" />
                            <path d="M9 18v2" />
                            <path d="M15 18v2" />
                            <path d="M9.5 12h.01" />
                            <path d="M14.5 12h.01" />
                            <path d="M10 15h4" />
                          </svg>
                          <div class="flex items-center gap-1 overflow-hidden">
                            <span class="whitespace-nowrap font-semibold text-sm">{{ modelSelector.activeModelLabelValue }}</span>
                            <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0" aria-hidden="true">
                              <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                            </svg>
                          </div>
                        </button>

                        <div
                          v-if="modelSelector.showModelMenuValue"
                          class="agent-model-selector-menu absolute bottom-12 right-0 z-[9999] w-72 overflow-visible rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
                        >
                        <div class="flex items-center justify-between px-3 py-2">
                          <div class="text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                            Local
                          </div>
                          <button
                            type="button"
                            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#0d0d0d]/60 hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                            @click="modelSelector.hideModelMenu"
                            aria-label="Close model selector"
                          >
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
                              <path d="M11.7816 4.03157C12.0724 3.74081 12.0724 3.25991 11.7816 2.96915C11.4909 2.67839 11.0099 2.67839 10.7192 2.96915L7.50005 6.18827L4.28091 2.96915C3.99015 2.67839 3.50925 2.67839 3.21849 2.96915C2.92773 3.25991 2.92773 3.74081 3.21849 4.03157L6.43761 7.25071L3.21849 10.4698C2.92773 10.7606 2.92773 11.2415 3.21849 11.5323C3.50925 11.823 3.99015 11.823 4.28091 11.5323L7.50005 8.31315L10.7192 11.5323C11.0099 11.823 11.4909 11.823 11.7816 11.5323C12.0724 11.2415 12.0724 10.7606 11.7816 10.4698L8.56248 7.25071L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                            </svg>
                          </button>
                        </div>

                        <div v-if="modelSelector.loadingLocalModelsValue" class="px-3 py-2 text-sm text-[#0d0d0d]/70 dark:text-white/70">
                          Loading...
                        </div>
                        <button
                          v-for="m in modelSelector.localModelOptionsValue"
                          :key="m.value"
                          type="button"
                          class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0d0d0d] hover:bg-[#f4f4f4] dark:text-white dark:hover:bg-white/10"
                          @click="modelSelector.selectModel(m)"
                        >
                          <span class="min-w-0 flex-1 truncate">{{ m.label }}</span>
                          <span v-if="m.isActive" class="shrink-0 text-xs font-semibold text-[#0d0d0d]/60 dark:text-white/60">Active</span>
                        </button>

                        <div class="border-t border-black/10 dark:border-white/10" />

                        <div class="px-3 py-2 text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                          Remote
                        </div>
                        <div v-if="!modelSelector.remoteOptionValue" class="px-3 py-2 text-sm text-[#0d0d0d]/70 dark:text-white/70">
                          No validated remote provider
                        </div>
                        <button
                          v-else
                          type="button"
                          class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0d0d0d] hover:bg-[#f4f4f4] dark:text-white dark:hover:bg-white/10"
                          @click="modelSelector.remoteOptionValue && modelSelector.selectModel(modelSelector.remoteOptionValue)"
                        >
                          <span class="min-w-0 flex-1 truncate">{{ modelSelector.remoteOptionValue?.label }}</span>
                          <span v-if="modelSelector.remoteOptionValue?.isActive" class="shrink-0 text-xs font-semibold text-[#0d0d0d]/60 dark:text-white/60">Active</span>
                        </button>
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <!-- Send button - always visible when there's content -->
                        <button
                          v-if="query.trim()"
                          type="button"
                          class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer dark:bg-white dark:text-[#0d0d0d]"
                          aria-label="Send"
                          :disabled="showOverlay"
                          @click="send"
                        >
                          <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                          </svg>
                        </button>

                        <!-- Stop button - only visible when chat interface exists and graph is running -->
                        <button
                          v-if="hasMessages && graphRunning"
                          type="button"
                          class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer dark:bg-red-500 dark:text-white"
                          aria-label="Stop"
                          :disabled="showOverlay"
                          @click="stop"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
                          </svg>
                        </button>

                        <!-- Voice button - shown when no content and not running -->
                        <button
                          v-if="!query.trim() && !graphRunning"
                          type="button"
                          class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer dark:bg-white dark:text-[#0d0d0d]"
                          aria-label="Voice"
                          :disabled="showOverlay"
                          @click="handlePrimaryAction"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 19v3" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <rect x="9" y="2" width="6" height="13" rx="3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StartupOverlay from './agent/StartupOverlay.vue';
import AgentHeader from './agent/AgentHeader.vue';
import AgentPersonaLibrary from './agent/personas/AgentPersonaLibrary.vue';
import AgentPersonaAssetCard from './agent/AgentPersonaAssetCard.vue';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';

import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  type PersonaSidebarAsset,
} from '@pkg/agent';
import { AgentSettingsController } from './agent/AgentSettingsController';
import { ChatInterface } from './agent/ChatInterface';
import { FrontendGraphWebSocketService } from '@pkg/agent/services/FrontendGraphWebSocketService';
import { AgentModelSelectorController } from './agent/AgentModelSelectorController';
import { getAgentPersonaRegistry, type ChatMessage } from '@pkg/agent';
import { getN8nVueBridgeService } from '@pkg/agent/services/N8nVueBridgeService';
import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import './assets/AgentModelSelector.css';
import './agent/personas/persona-profiles.css';

const renderMarkdown = (markdown: string): string => {
  const raw = typeof markdown === 'string' ? markdown : String(markdown || '');
  const html = (marked(raw) as string) || '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
};

const sanitizeAssetHtml = (html: string): string => {
  const raw = typeof html === 'string' ? html : String(html || '');
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);

  if (!looksLikeHtml) {
    return renderMarkdown(raw);
  }

  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
};

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const syncN8nInterfaceTheme = (): void => {
  const n8nVueBridgeService = getN8nVueBridgeService();
  if (isDark.value) {
    n8nVueBridgeService.setDarkMode();
    return;
  }

  n8nVueBridgeService.setLightMode();
};

const currentThreadId = ref<string | null>(null);

const composerTextareaEl = ref<HTMLTextAreaElement | null>(null);
const isComposerMultiline = ref(false);

let composerMirrorEl: HTMLDivElement | null = null;
let composerMeasureCanvas: HTMLCanvasElement | null = null;

function getComposerMirrorEl(): HTMLDivElement {
  if (composerMirrorEl) {
    return composerMirrorEl;
  }
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-99999px';
  el.style.top = '0';
  el.style.visibility = 'hidden';
  el.style.whiteSpace = 'pre-wrap';
  el.style.wordBreak = 'break-word';
  el.style.overflowWrap = 'break-word';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  composerMirrorEl = el;
  return el;
}

function updateComposerLayout(): void {
  const el = composerTextareaEl.value;
  if (!el) {
    return;
  }

  const style = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight || '24');
  const paddingTop = Number.parseFloat(style.paddingTop || '0');
  const paddingBottom = Number.parseFloat(style.paddingBottom || '0');
  const singleLineHeight = Math.ceil(lineHeight + paddingTop + paddingBottom);

  if (!composerMeasureCanvas) {
    composerMeasureCanvas = document.createElement('canvas');
  }
  const ctx = composerMeasureCanvas.getContext('2d');
  const font = style.font ? style.font : `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  if (ctx) {
    ctx.font = font;
  }

  const mirror = getComposerMirrorEl();
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.textTransform = style.textTransform;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.width = `${el.clientWidth}px`;

  // Add a trailing newline to ensure the last line's height is counted accurately.
  mirror.textContent = `${el.value || ''}\n`;
  const measuredHeight = mirror.scrollHeight;

  const typed = el.value || '';
  const typedWidthPx = ctx ? ctx.measureText(typed).width : 0;
  const earlyMultiline = typedWidthPx > (el.clientWidth * 0.5);

  const multiline = measuredHeight > (singleLineHeight + 1) || typed.includes('\n') || earlyMultiline;
  isComposerMultiline.value = multiline;

  const maxPx = 400;
  if (!multiline) {
    el.style.height = `${singleLineHeight}px`;
    return;
  }

  // Now allow it to expand to fit content (capped).
  el.style.height = 'auto';
  const minMultilineHeight = Math.ceil(singleLineHeight * 2);
  const nextHeight = Math.min(Math.max(el.scrollHeight, minMultilineHeight), maxPx);
  el.style.height = `${nextHeight}px`;
}

const showOverlay = ref(false);
const modelName = ref('');
const modelMode = ref<'local' | 'remote'>('local');
const systemReady = ref(false);

const settingsController = new AgentSettingsController(
  {
    modelName,
    modelMode,
  },
);

const chatController = new ChatInterface();

const frontendGraphController = new FrontendGraphWebSocketService({
  currentThreadId,
});

const {
  query,
  messages,
  hasMessages,
  graphRunning,
} = chatController;

const displayMessages = computed(() => {
  return messages.value.filter((m: ChatMessage) => {
    const kind = String((m as any)?.metadata?.kind || '').trim();
    return kind !== 'action_live_n8n_event';
  });
});

const registry = getAgentPersonaRegistry();
const loading = computed<boolean>(() => {
  const agent = registry.activeAgent.value;
  if (!agent) return false;
  return agent.loading;
});

const handleModelChanged = async (event: Electron.IpcRendererEvent, data: { model: string; type: 'local' } | { model: string; type: 'remote'; provider: string }) => {
  modelName.value = data.model;
  modelMode.value = data.type;
  // Reload model selector so its internal remote refs stay in sync
  await modelSelector.start();
};

// Track expanded tool cards
const expandedToolCards = ref<Set<string>>(new Set());

function toggleToolCard(messageId: string): void {
  if (expandedToolCards.value.has(messageId)) {
    expandedToolCards.value.delete(messageId);
  } else {
    expandedToolCards.value.add(messageId);
  }
}

function isToolCardExpanded(messageId: string): boolean {
  return expandedToolCards.value.has(messageId);
}

const chatScrollContainer = ref<HTMLElement | null>(null);
const autoScrollEnabled = ref(true);
const autoScrollThreshold = 140; // pixels from bottom to re-enable
let isUserScrolling = false;
let scrollTimeout: NodeJS.Timeout | null = null;

// Track user-initiated scrolling with mouse/touch events
onMounted(() => {
  const container = chatScrollContainer.value;
  if (!container) return;

  // Detect when user starts scrolling
  const startUserScroll = () => {
    isUserScrolling = true;
  };

  // Detect when user stops scrolling
  const endUserScroll = () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isUserScrolling = false;
    }, 150);
  };

  // Mouse wheel events
  container.addEventListener('wheel', startUserScroll, { passive: true });
  container.addEventListener('wheel', endUserScroll, { passive: true });

  // Touch events for mobile
  container.addEventListener('touchstart', startUserScroll, { passive: true });
  container.addEventListener('touchend', endUserScroll, { passive: true });

  // Track scroll position changes (only when user is scrolling)
  container.addEventListener('scroll', () => {
    if (!isUserScrolling) return;
    
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const wasEnabled = autoScrollEnabled.value;
    autoScrollEnabled.value = distanceFromBottom <= autoScrollThreshold;
    
    if (wasEnabled !== autoScrollEnabled.value) {
      console.log('[Auto-Scroll] State changed:', autoScrollEnabled.value ? 'ENABLED' : 'DISABLED', 
                  `(${Math.round(distanceFromBottom)}px from bottom)`);
    }
  }, { passive: true });

});

// Auto-scroll to bottom when messages change (only if enabled)
watch(() => messages.value.length, async () => {
  await nextTick();
  const container = chatScrollContainer.value;
  if (!container) {
    return;
  }
  
  if (!autoScrollEnabled.value) {
    console.log('[Auto-Scroll] SKIPPED - user scrolled up, messages count:', messages.value.length);
    return;
  }
  
  console.log('[Auto-Scroll] Scrolling to bottom, messages count:', messages.value.length);
  container.scrollTop = container.scrollHeight; // Instant scroll, no smooth behavior
}, { flush: 'post' });

const latestChatError = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m: ChatMessage = messages.value[i];
    if (m.role === 'error') {
      return m.content;
    }
  }
  return '';
});

const activePersonaService = computed(() => registry.getActivePersonaService());
const personaAssets = computed(() => activePersonaService.value?.activeAssets ?? []);
type AssetSize = 'medium' | 'large';
const assetSizes = ref<Record<string, AssetSize>>({});

const normalizeAssetSize = (value: unknown): AssetSize => {
  return value === 'large' ? 'large' : 'medium';
};

const getAssetSize = (assetId: string): AssetSize => normalizeAssetSize(assetSizes.value[assetId]);

const largeAssetId = computed(() => {
  return personaAssets.value.find((asset) => getAssetSize(asset.id) === 'large')?.id || null;
});

const visiblePersonaAssets = computed(() => {
  if (largeAssetId.value) {
    return personaAssets.value.filter((asset) => asset.id === largeAssetId.value);
  }
  return personaAssets.value;
});

const isAssetPaneExpanded = computed(() => !!largeAssetId.value);

const setAssetSize = (assetId: string, nextSize: AssetSize): void => {
  if (nextSize === 'large') {
    const nextMap: Record<string, AssetSize> = {};
    personaAssets.value.forEach((asset) => {
      nextMap[asset.id] = asset.id === assetId ? 'large' : 'medium';
    });
    assetSizes.value = nextMap;
    return;
  }

  assetSizes.value = {
    ...assetSizes.value,
    [assetId]: nextSize,
  };
};

const cycleAssetSize = (assetId: string): void => {
  const current = getAssetSize(assetId);
  if (current === 'medium') {
    setAssetSize(assetId, 'large');
    return;
  }
  setAssetSize(assetId, 'medium');
};

const handleAssetPaneScrollLock = (event: Event): void => {
  if (!isAssetPaneExpanded.value) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
};

watch(personaAssets, (assets) => {
  const ids = new Set(assets.map((asset) => asset.id));
  const nextSizes: Record<string, AssetSize> = {};
  Object.entries(assetSizes.value).forEach(([assetId, size]) => {
    if (ids.has(assetId)) {
      nextSizes[assetId] = normalizeAssetSize(size);
    }
  });
  assets.forEach((asset) => {
    if (!nextSizes[asset.id]) {
      nextSizes[asset.id] = 'medium';
    }
  });
  assetSizes.value = nextSizes;
}, { immediate: true });

const onDocumentAssetInput = (assetId: string, event: Event): void => {
  const service = activePersonaService.value;
  if (!service) {
    return;
  }
  const target = event.target as HTMLElement;
  service.updateDocumentAssetContent(assetId, target.innerHTML || '');
};

const applyDocumentFormat = (command: string, value?: string): void => {
  if (command === 'createLink') {
    const url = window.prompt('Enter URL');
    if (!url) {
      return;
    }
    document.execCommand(command, false, url);
    return;
  }
  document.execCommand(command, false, value);
};

const assetIsActive = (asset: PersonaSidebarAsset): boolean => {
  return asset.active === true;
};

const isRunning = computed<boolean>(() => {
  const agent = registry.activeAgent.value;
  if (!agent) return false;
  return agent.isRunning;
});

const modelSelector = new AgentModelSelectorController({
  systemReady,
  loading,
  modelName,
  modelMode,
  isRunning,
});

onMounted(async () => {
  const n8nVueBridgeService = getN8nVueBridgeService();
  n8nVueBridgeService.markInitialized('Agent.vue:onMounted');

  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === 'dark') {
    isDark.value = true;
  } else if (stored === 'light') {
    isDark.value = false;
  } else {
    isDark.value = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  // Listen for model changes from other windows
  ipcRenderer.on('model-changed', handleModelChanged);

  // Load settings eagerly — SullaSettingsModel has a disk fallback even before Redis/PG are ready
  await settingsController.start();
  await modelSelector.start();
  syncN8nInterfaceTheme();
});

// Re-sync settings when system is fully ready (bootstrap may have updated values)
watch(systemReady, async (ready) => {
  if (ready) {
    await settingsController.start();
    await modelSelector.start();
  }
});

onUnmounted(() => {
  modelSelector.dispose();
  // Stop listening on each agent's persona service
  registry.state.agents.forEach((agent: { agentId: string }) => {
    registry.getOrCreatePersonaService(agent.agentId).stopListening();
  });
  chatController.dispose();
  frontendGraphController.dispose();
});

const send = () => {
  chatController.send();
};

const stop = () => {
  chatController.stop();
};

const handlePrimaryAction = () => {
  if (query.value.trim()) {
    send();
    return;
  }
  // Voice mode is a UI affordance for now; actual voice wiring can be added later.
};

watch(query, async () => {
  await nextTick();
  updateComposerLayout();
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

watch(isDark, () => {
  syncN8nInterfaceTheme();
}, { immediate: true });

const handleModelSwitcherClick = () => {
  console.log('[Agent] Model switcher clicked');
  modelSelector.toggleModelMenu();
};

</script>

<style scoped>
/* Match knowledgebase dark-mode scrollbar styling in chat interface */
.dark #chat-scroll-container::-webkit-scrollbar,
.dark #chat-scroll-container *::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dark #chat-scroll-container::-webkit-scrollbar-track,
.dark #chat-scroll-container *::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 4px;
}

.dark #chat-scroll-container::-webkit-scrollbar-thumb,
.dark #chat-scroll-container *::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.dark #chat-scroll-container::-webkit-scrollbar-thumb:hover,
.dark #chat-scroll-container *::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.dark #chat-scroll-container::-webkit-scrollbar-corner,
.dark #chat-scroll-container *::-webkit-scrollbar-corner {
  background: #1e293b;
}
</style>

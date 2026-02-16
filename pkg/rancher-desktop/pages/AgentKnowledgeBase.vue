<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32 dark:min-h-[600px] banner-dark-min-height relative before:absolute before:inset-0 before:bg-linear-to-b before:from-transparent before:via-transparent before:to-slate-900 dark:before:to-slate-900 before:pointer-events-none before:z-5">
          <img alt="" width="530" height="530" decoding="async" data-nimg="1"
            class="absolute right-full bottom-full -mr-72 -mb-56 opacity-50" style="color:transparent"
            :src="splashUrl">
          <img alt="" width="530" height="530" decoding="async" data-nimg="1" 
            class="absolute -top-64 -right-64"
            style="color:transparent" :src="splashUrl">
          <img alt="" width="567" height="567" decoding="async" data-nimg="1"
            class="absolute -right-44 -bottom-40" style="color:transparent" :src="splash2Url">
          
          <div class="absolute inset-0 z-0 opacity-30">
            <KnowledgeGraph />
          </div>

          <!-- Overlay content with toggle -->
          <div class="relative z-10">
            <div class="absolute top-4 right-4 z-20">
              <button 
                @click="showOverlay = !showOverlay"
                class="px-4 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white/90 hover:text-white text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-slate-600/50 shadow-lg"
              >
                {{ showOverlay ? 'Hide Overlay' : 'Show Overlay' }}
              </button>
            </div>

            <div 
              v-if="showOverlay"
              class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20 transition-all duration-500"
            >
              <div
                class="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
                <div class="relative z-10 md:text-center lg:text-left">
                  <div class="relative">
                    <p
                      class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                      Sulla KnowledgeBase.</p>
                    <p class="mt-3 text-2xl tracking-tight text-slate-400">
                      Long-term memories Sulla has collected and organized through dreaming.
                    </p>
                    <div class="mt-8 flex gap-4 md:justify-center lg:justify-start">
                      <router-link
                        to="/KnowledgeBase/Create"
                        class="text-sm font-semibold rounded-full bg-sky-300 py-2 px-4 text-sm font-semibold text-slate-900 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/50 active:bg-sky-500"
                      >
                        Create new page
                      </router-link>
                      <a
                        class="rounded-full bg-slate-800 py-2 px-4 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400"
                        href="#"
                        @click.prevent="$router.push('/KnowledgeBase/Sections')"
                      >
                        Manage Sections
                      </a>
                    </div>
                  </div>
                </div>
                <div class="relative lg:static xl:pl-10">
                  <div class="flex flex-col gap-4">
                    <div class="relative">
                      <svg aria-hidden="true" viewBox="0 0 20 20" class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 fill-slate-400 dark:fill-slate-500">
                        <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"></path>
                      </svg>

                      <input
                        v-model="searchInput"
                        type="text"
                        placeholder="Search knowledge base"
                        class="h-11 w-full rounded-lg bg-white/95 pr-4 pl-12 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300/50 dark:bg-slate-800/75 dark:text-slate-100 dark:ring-white/5 dark:ring-inset"
                        @keydown.enter="performSearch"
                      >
                      <kbd class="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 font-medium text-slate-400 md:block dark:text-slate-500">
                        <kbd class="font-sans">⌘</kbd><kbd class="font-sans">K</kbd>
                      </kbd>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="flex h-6 rounded-full p-px text-xs font-medium"
                        :class="activeCategory === null ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                        @click="selectCategory(null)"
                      >
                        <span class="flex items-center rounded-full px-2.5" :class="activeCategory === null ? 'bg-slate-800' : ''">All</span>
                      </button>
                      <button
                        v-for="category in categories"
                        :key="category"
                        type="button"
                        class="flex h-6 rounded-full p-px text-xs font-medium"
                        :class="activeCategory === category ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                        @click="selectCategory(category)"
                      >
                        <span class="flex items-center rounded-full px-2.5" :class="activeCategory === category ? 'bg-slate-800' : ''">{{ category }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="relative mx-auto flex w-full max-w-8xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12 relative z-20">
          <div class="hidden lg:relative lg:block lg:flex-none">
            <div class="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden"></div>
            <div class="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block"></div>
            <div class="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block"></div>
            <div class="sticky top-19 -ml-0.5 h-[calc(100vh-4.75rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16">
              <nav class="text-base lg:text-sm">
                <ul role="list" class="space-y-9">
                  <li v-if="loadingPages" class="text-sm text-slate-500 dark:text-slate-400">Loading…</li>
                  <li v-else-if="nav.length === 0" class="text-sm text-slate-500 dark:text-slate-400">No KnowledgeBase pages found.</li>
                  <li v-for="group in nav" :key="group.tag">
                    <h2 class="font-display font-medium text-slate-900 dark:text-white">{{ group.tag }}</h2>
                    <ul role="list" class="mt-2 space-y-2 border-l-2 border-slate-100 lg:mt-4 lg:space-y-4 lg:border-slate-200 dark:border-slate-800">
                      <li v-for="p in group.pages" :key="p.slug" class="relative group/nav">
                        <div class="flex items-center">
                          <a
                            href="#"
                            class="block w-full pl-3.5 before:pointer-events-none before:absolute before:top-1/2 before:-left-1 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full"
                            :class="activeSlug === p.slug
                              ? 'font-semibold text-sky-500 before:bg-sky-500'
                              : 'text-slate-500 before:hidden before:bg-slate-300 hover:text-slate-600 hover:before:block dark:text-slate-400 dark:before:bg-slate-700 dark:hover:text-slate-300'"
                            @click.prevent="selectPage(p.slug)"
                          >
                            {{ p.title }}
                          </a>
                          <router-link
                            :to="{ name: 'AgentKnowledgeBaseEdit', params: { slug: p.slug } }"
                            class="ml-1 flex-shrink-0 opacity-0 group-hover/nav:opacity-100 transition-opacity text-slate-400 hover:text-sky-500"
                            title="Edit article"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </router-link>
                        </div>
                      </li>
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16 relative z-20">
            <div v-if="searchResults.length > 0" class="space-y-6">
              <div v-for="article in paginatedResults" :key="article.slug" class="blog-post border-b border-slate-200 pb-6 dark:border-slate-700">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">{{ article.title }}</h2>
                <p class="text-slate-600 dark:text-slate-300 mt-2">{{ article.excerpt }}</p>
                <div class="mt-4 flex items-center gap-3">
                  <button @click="selectPage(article.slug)" class="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600">Read more</button>
                  <router-link
                    :to="{ name: 'AgentKnowledgeBaseEdit', params: { slug: article.slug } }"
                    class="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-sky-500 rounded border border-slate-300 hover:border-sky-500 dark:border-slate-600 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:border-sky-400 transition-colors"
                    title="Edit article"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit
                  </router-link>
                </div>
              </div>
              <div class="flex justify-between items-center mt-8" v-if="searchResults.length > pageSize">
                <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded disabled:opacity-50">Previous</button>
                <span class="text-slate-700 dark:text-slate-300">Page {{ page }} of {{ Math.ceil(searchResults.length / pageSize) }}</span>
                <button @click="page = Math.min(Math.ceil(searchResults.length / pageSize), page + 1)" :disabled="page >= Math.ceil(searchResults.length / pageSize)" class="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
            <div v-else-if="categoryTitle" class="space-y-6">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-white">{{ categoryTitle === '' ? 'All Articles' : `Articles in ${categoryTitle}` }}</h1>
              <div v-for="article in paginatedResults" :key="article.slug" class="blog-post border-b border-slate-200 pb-6 dark:border-slate-700">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">{{ article.title }}</h2>
                <p class="text-slate-600 dark:text-slate-300 mt-2">{{ article.excerpt }}</p>
                <div class="mt-4 flex items-center gap-3">
                  <button @click="selectPage(article.slug)" class="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600">Read more</button>
                  <router-link
                    :to="{ name: 'AgentKnowledgeBaseEdit', params: { slug: article.slug } }"
                    class="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-sky-500 rounded border border-slate-300 hover:border-sky-500 dark:border-slate-600 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:border-sky-400 transition-colors"
                    title="Edit article"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit
                  </router-link>
                </div>
              </div>
              <div class="flex justify-between items-center mt-8" v-if="filteredPages.length > pageSize">
                <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded disabled:opacity-50">Previous</button>
                <span class="text-slate-700 dark:text-slate-300">Page {{ page }} of {{ Math.ceil(filteredPages.length / pageSize) }}</span>
                <button @click="page = Math.min(Math.ceil(filteredPages.length / pageSize), page + 1)" :disabled="page >= Math.ceil(filteredPages.length / pageSize)" class="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
            <article v-else-if="activePage">
              <header class="mb-9 space-y-1">
                <p class="font-display text-sm font-medium text-sky-500">{{ (activePage.tags && activePage.tags[0]) || 'Memory' }}</p>
                <div class="flex items-center gap-3">
                  <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">{{ activePage.title }}</h1>
                  <router-link
                    :to="{ name: 'AgentKnowledgeBaseEdit', params: { slug: activePage.slug } }"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm text-slate-400 hover:text-sky-500 rounded border border-slate-300 hover:border-sky-500 dark:border-slate-600 dark:hover:border-sky-400 transition-colors"
                    title="Edit article"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit
                  </router-link>
                </div>
              </header>
              <div
                ref="articleContentEl"
                class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34 prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 dark:[--tw-prose-background:var(--color-slate-900)] prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,var(--color-sky-800))] dark:prose-a:hover:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800"
                v-html="renderedContent"></div>

              <!-- Related Articles at bottom of article -->
              <div v-if="relatedArticles.length > 0" class="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
                <h2 class="font-display text-sm font-medium text-slate-900 dark:text-white mb-4">Related Articles</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    v-for="article in relatedArticles"
                    :key="article.slug"
                    @click="selectPage(article.slug)"
                    class="group flex items-start gap-3 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div class="flex-shrink-0 mt-0.5 w-8 h-8 rounded-md bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-600 dark:text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate">{{ article.title }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {{ article.tags && article.tags[0] ? article.tags[0] : 'Article' }}
                        <span v-if="article.updated_at" class="ml-1">&middot; {{ new Date(article.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <dl v-if="prevPage || nextPage" class="mt-12 flex border-t border-slate-200 pt-6 dark:border-slate-800">
                <div v-if="prevPage">
                  <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Previous</dt>
                  <dd class="mt-1">
                    <a
                      class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 flex-row-reverse"
                      href="#"
                      @click.prevent="selectPage(prevPage.slug)"
                    >
                      {{ prevPage.title }}
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current -scale-x-100">
                        <path d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"></path>
                      </svg>
                    </a>
                  </dd>
                </div>
                <div v-if="nextPage" class="ml-auto text-right">
                  <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Next</dt>
                  <dd class="mt-1">
                    <a
                      class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                      href="#"
                      @click.prevent="selectPage(nextPage.slug)"
                    >
                      {{ nextPage.title }}
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current">
                        <path d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"></path>
                      </svg>
                    </a>
                  </dd>
                </div>
              </dl>
            </article>
            <article v-else-if="loadingPage" class="py-16 text-center text-slate-500 dark:text-slate-400">
              Loading...
            </article>
            <article v-else class="py-16 text-center text-slate-500 dark:text-slate-400">
              Select an article from the sidebar.
            </article>
          </div>
          <div class="hidden xl:sticky xl:top-19 xl:-mr-6 xl:block xl:h-[calc(100vh-4.75rem)] xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6 relative z-20">
            <nav aria-labelledby="on-this-page-title" class="w-56">
              <h2 id="on-this-page-title" class="font-display text-sm font-medium text-slate-900 dark:text-white">On
                this page</h2>
              <ol role="list" class="mt-4 space-y-3 text-sm">
                <li v-for="heading in tableOfContents" :key="heading.id">
                  <h3 v-if="heading.level === 1">
                    <a class="text-sky-500" :href="'#' + heading.id" @click.prevent="scrollToHeading(heading.id)">{{ heading.text }}</a>
                  </h3>
                  <a v-else
                    class="font-normal text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    :class="{ 'pl-4': heading.level === 2 }"
                    :href="'#' + heading.id" @click.prevent="scrollToHeading(heading.id)">{{ heading.text }}</a>
                </li>
              </ol>
            </nav>

            <!-- Article Meta Information -->
            <div v-if="activePage" class="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
              <!-- Article Tags -->
              <div v-if="activePage.tags && activePage.tags.length > 0" class="mb-6">
                <h3 class="font-display text-sm font-medium text-slate-900 dark:text-white mb-3">Tags</h3>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in activePage.tags"
                    :key="tag"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>

              <!-- Article Metadata -->
              <div class="mb-6">
                <h3 class="font-display text-sm font-medium text-slate-900 dark:text-white mb-3">Article Info</h3>
                <dl class="space-y-2 text-sm">
                  <div v-if="activePage.updated_at">
                    <dt class="font-medium text-slate-500 dark:text-slate-400">Last Updated</dt>
                    <dd class="text-slate-900 dark:text-white">{{ new Date(activePage.updated_at).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) }}</dd>
                  </div>
                  <div v-if="activePage.slug">
                    <dt class="font-medium text-slate-500 dark:text-slate-400">Slug</dt>
                    <dd class="text-slate-900 dark:text-white font-mono text-xs">{{ activePage.slug }}</dd>
                  </div>
                </dl>
              </div>

              <!-- Related Articles -->
              <div v-if="relatedArticles.length > 0" class="mb-6">
                <h3 class="font-display text-sm font-medium text-slate-900 dark:text-white mb-3">Related Articles</h3>
                <ul class="space-y-2">
                  <li v-for="article in relatedArticles.slice(0, 5)" :key="article.slug">
                    <a
                      href="#"
                      class="block text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                      @click.prevent="selectPage(article.slug)"
                    >
                      <div class="font-medium">{{ article.title }}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {{ article.tags && article.tags[0] ? article.tags[0] : 'Article' }}
                      </div>
                    </a>
                  </li>
                </ul>
              </div>

              <!-- Quick Actions -->
              <div class="mb-6">
                <h3 class="font-display text-sm font-medium text-slate-900 dark:text-white mb-3">Quick Actions</h3>
                <div class="space-y-2">
                  <button
                    @click="$router.push({ name: 'AgentKnowledgeBaseSearch', query: { category: activePage.tags?.[0] } })"
                    class="w-full text-left px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                  >
                    Find similar articles
                  </button>
                  <button
                    @click="$router.push({ name: 'AgentKnowledgeBaseSearch' })"
                    class="w-full text-left px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                  >
                    Browse all articles
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import KnowledgeGraph from './KnowledgeGraph.vue';
import AgentHeader from './agent/AgentHeader.vue';
import { articlesRegistry } from '../agent/database/registry/ArticlesRegistry';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import './assets/AgentKnowledgeBase.css';
import type { ArticleListItem, ArticleWithContent } from '../agent/database/registry/ArticlesRegistry';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const showOverlay = ref(true);  // ← new toggle state

const router = useRouter();

const query = ref('');
const activeCategory = ref<string | null>(null);
const searchInput = ref('');
const page = ref(1);
const pageSize = 10;
const categoryTitle = ref('');
const searchResults = ref<ArticleListItem[]>([]);

const splashUrl = new URL('./assets/splash.png', import.meta.url).toString();
const splash2Url = new URL('./assets/splash2.png', import.meta.url).toString();

const loadingPages = ref(false);
const pages = ref<ArticleListItem[]>([]);
const activeSlug = ref<string | null>(null);
const activePage = ref<ArticleWithContent | null>(null);
const loadingPage = ref(false);
const articleContentEl = ref<HTMLElement | null>(null);


interface TocHeading {
  id: string;
  text: string;
  level: number;
}

function slugifyHeading(text: string): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

function scrollToHeading(id: string): void {
  const targetId = String(id || '').trim();
  if (!targetId) return;

  const container = articleContentEl.value;
  const el = container?.querySelector(`[id="${targetId}"]`) || document.getElementById(targetId);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const renderedContent = computed(() => {
  if (!activePage.value?.document) return '<p class="text-slate-500">No content available.</p>';

  let markdown = activePage.value.document;

  // Parse literal \n escape sequences to actual newlines
  markdown = markdown.replace(/\\n/g, '\n');

  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = tokens.map((t: any) => t.text || '').join('');
    const id = slugifyHeading(text);
    return `<h${depth} id="${id}">${marked.parseInline(text)}</h${depth}>`;
  };

  const html = marked(markdown, { renderer }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
});

const tableOfContents = computed<TocHeading[]>(() => {
  if (!renderedContent.value) return [];

  const headings: TocHeading[] = [];
  const regex = /<h([12])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h[12]>/gi;
  let match;
  while ((match = regex.exec(renderedContent.value)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id: match[2],
      text: match[3].trim(),
    });
  }

  if (headings.length === 0) {
    const simpleRegex = /<h([12])[^>]*>([^<]*)<\/h[12]>/gi;
    let idx = 0;
    while ((match = simpleRegex.exec(renderedContent.value)) !== null) {
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `heading-${idx}`;
      headings.push({ level: parseInt(match[1], 10), id, text });
      idx++;
    }
  }

  return headings;
});

const filteredPages = computed(() => {
  const q = query.value.trim().toLowerCase();
  const category = activeCategory.value;

  return pages.value.filter(p => {
    if (category && p.tags && !p.tags.includes(category)) {
      return false;
    }

    if (!q) return true;

    return (p.title || '').toLowerCase().includes(q);
  });
});

const paginatedResults = computed(() => {
  const items = searchResults.value.length > 0 ? searchResults.value : filteredPages.value;
  const start = (page.value - 1) * pageSize;
  return items.slice(start, start + pageSize);
});

const sortedPagesByDate = computed(() => {
  const parseTime = (v: string | null): number => Date.parse(v || '') || 0;

  return [...filteredPages.value].sort((a, b) => {
    const ta = parseTime(a.updated_at);
    const tb = parseTime(b.updated_at);
    if (ta !== tb) return ta - tb;
    if (a.order !== b.order) return Number(a.order || 0) - Number(b.order || 0);
    return String(a.slug).localeCompare(String(b.slug));
  });
});

const nextPage = computed<any | null>(() => {
  const slug = activeSlug.value;
  if (!slug) return null;
  const idx = sortedPagesByDate.value.findIndex(p => p.slug === slug);
  return idx < sortedPagesByDate.value.length - 1 ? sortedPagesByDate.value[idx + 1] : null;
});

const prevPage = computed<any | null>(() => {
  const slug = activeSlug.value;
  if (!slug) return null;
  const idx = sortedPagesByDate.value.findIndex(p => p.slug === slug);
  return idx > 0 ? sortedPagesByDate.value[idx - 1] : null;
});

const relatedArticles = computed(() => {
  if (!activePage.value?.tags || activePage.value.tags.length === 0) return [];
  
  // Find articles that share at least one tag with the current article
  return pages.value.filter(article => {
    if (article.slug === activePage.value?.slug) return false; // Exclude current article
    
    return article.tags && article.tags.some(tag => 
      activePage.value?.tags?.includes(tag)
    );
  }).slice(0, 5); // Limit to 5 related articles
});

const nav = ref<{ tag: string; pages: ArticleListItem[] }[]>([]);

const categories = computed(() => {
  return nav.value.map(n => n.tag);
});

const performSearch = async () => {
  const q = searchInput.value.trim();
  if (q) {
    // Navigate to search page with query parameter
    router.push({ name: 'AgentKnowledgeBaseSearch', query: { q } });
  }
};

const selectCategory = (category: string | null) => {
  if (category) {
    // Navigate to search page with category parameter
    router.push({ name: 'AgentKnowledgeBaseSearch', query: { category } });
  } else {
    // For "All" category, navigate to search page without parameters
    router.push({ name: 'AgentKnowledgeBaseSearch' });
  }
};

const selectPage = async (slug: string) => {
  const id = String(slug || '').trim();
  if (!id) return;

  activeSlug.value = id;
  loadingPage.value = true;

  try {
    const article = await articlesRegistry.getBySlug(id);
    if (!article) {
      activePage.value = null;
      return;
    }

    activePage.value = article;
  } catch (err) {
    console.error('Failed to load article:', err);
    activePage.value = null;
  } finally {
    loadingPage.value = false;
  }
};

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {}

  loadingPages.value = true;
  try {
    // Load nav structure from registry
    nav.value = await articlesRegistry.getNavStructure();
    
    // Also load pages for other functionality
    const result = await articlesRegistry.search({ limit: 100 });
    pages.value = result.items;
  } catch (err) {
    console.error('Failed to load articles:', err);
  } finally {
    loadingPages.value = false;
  }
  console.log('activeSlug', activeSlug.value);
  if (!activeSlug.value && nav.value.length > 0 && nav.value[0].pages.length > 0) {
    await selectPage(nav.value[0].pages[0].slug);
  }
});

watch(() => query.value, () => {
  if (activeSlug.value) {
    const stillVisible = filteredPages.value.some(p => p.slug === activeSlug.value);
    if (!stillVisible) {
      activeSlug.value = null;
      activePage.value = null;
    }
  }
});

function toggleTheme() {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
}
</script>

<style scoped>
.dark .banner-dark-min-height {
  min-height: 600px;
}

/* Dark mode scrollbars for all scrollable areas */
.dark ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dark ::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.dark ::-webkit-scrollbar-corner {
  background: #1e293b;
}
</style>

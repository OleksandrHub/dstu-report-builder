<script setup lang="ts">
import { ref } from 'vue'
import DocumentManager from './components/DocumentManager.vue'
import { RouterView } from 'vue-router'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="root-layout">
    <nav class="top-nav">
      <button class="nav-menu-btn" @click="sidebarOpen = !sidebarOpen" title="Мої роботи">
        ☰
      </button>
      <span class="nav-title">ДСТУ Конструктор звітів</span>
    </nav>

    <div class="root-body">
      <transition name="slide">
        <div v-if="sidebarOpen" class="doc-sidebar">
          <DocumentManager />
        </div>
      </transition>

      <div class="main-content" :class="{ 'sidebar-open': sidebarOpen }">
        <RouterView />
      </div>
    </div>
  </div>
</template>

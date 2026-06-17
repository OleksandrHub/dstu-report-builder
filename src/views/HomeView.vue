<script setup lang="ts">
import { ref, watch } from 'vue'
import { renderAsync } from 'docx-preview'
import { useReportStore } from '../stores/report'
import { useReport } from '../composables/useReport'
import { useDocxExport } from '../composables/useDocxExport'

import ParagraphBlock from '../components/blocks/ParagraphBlock.vue'
import HeadingBlock from '../components/blocks/HeadingBlock.vue'
import ListBlockEditor from '../components/blocks/ListBlock.vue'
import CodeBlockEditor from '../components/blocks/CodeBlock.vue'
import ImageBlockEditor from '../components/blocks/ImageBlock.vue'
import TableBlockEditor from '../components/blocks/TableBlock.vue'
import TitlePageEditor from '../components/editor/TitlePageEditor.vue'
import TitleTemplateEditor from '../components/editor/TitleTemplateEditor.vue'
import IntroEditor from '../components/editor/IntroEditor.vue'
import SettingsEditor from '../components/editor/SettingsEditor.vue'

import type { ReportBlock } from '../types/document'

const store = useReportStore()
const { doc, getBlockIndex, formatListItem } = useReport()
const { exportToDocx, getPreviewBlob } = useDocxExport()

type LeftTab = 'titlepage' | 'titleblocks' | 'intro' | 'blocks' | 'settings'
const leftTab = ref<LeftTab>('titlepage')

// docx-preview
const previewContainer = ref<HTMLElement | null>(null)
const previewLoading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function refreshPreview() {
  if (!doc.value || !previewContainer.value) return
  previewLoading.value = true
  try {
    const blob = await getPreviewBlob(doc.value)
    await renderAsync(blob, previewContainer.value, undefined, {
      className: 'docx-preview',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      useBase64URL: true,
    })
  } finally {
    previewLoading.value = false
  }
}

watch(
  doc,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(refreshPreview, 700)
  },
  { deep: true, immediate: true },
)

async function handleExport() {
  if (!doc.value) return
  await exportToDocx(doc.value)
}

function onUpdateBlock(id: string, data: Partial<ReportBlock>) {
  store.updateBlock(id, data)
}
</script>

<template>
  <div class="app-layout">
    <!-- LEFT: Editor panel -->
    <aside class="editor-panel">
      <div class="panel-header">
        <div class="doc-name-row">
          <input
            class="doc-name-input"
            :value="doc?.name"
            @input="store.renameDocument(doc!.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="tab-bar">
          <button :class="['tab', { active: leftTab === 'titlepage' }]" @click="leftTab = 'titlepage'">Дані</button>
          <button :class="['tab', { active: leftTab === 'titleblocks' }]" @click="leftTab = 'titleblocks'">Макет</button>
          <button :class="['tab', { active: leftTab === 'intro' }]" @click="leftTab = 'intro'">Вступ</button>
          <button :class="['tab', { active: leftTab === 'blocks' }]" @click="leftTab = 'blocks'">Блоки</button>
          <button :class="['tab', { active: leftTab === 'settings' }]" @click="leftTab = 'settings'">Стиль</button>
        </div>
      </div>

      <div class="panel-body">
        <TitlePageEditor v-if="leftTab === 'titlepage'" />
        <TitleTemplateEditor v-else-if="leftTab === 'titleblocks'" />
        <IntroEditor v-else-if="leftTab === 'intro'" />
        <SettingsEditor v-else-if="leftTab === 'settings'" />

        <div v-else-if="leftTab === 'blocks'" class="blocks-editor">
          <div v-if="doc && doc.blocks.length === 0" class="empty-blocks-hint">
            Документ порожній. Додай перший блок нижче.
          </div>

          <template v-if="doc">
            <template v-for="block in doc.blocks" :key="block.id">
              <ParagraphBlock
                v-if="block.type === 'paragraph'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <HeadingBlock
                v-else-if="block.type === 'heading'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <ListBlockEditor
                v-else-if="block.type === 'list'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <CodeBlockEditor
                v-else-if="block.type === 'code'"
                :block="block"
                :index="getBlockIndex(block.id, 'code')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <ImageBlockEditor
                v-else-if="block.type === 'image'"
                :block="block"
                :index="getBlockIndex(block.id, 'image')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <TableBlockEditor
                v-else-if="block.type === 'table'"
                :block="block"
                :index="getBlockIndex(block.id, 'table')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
            </template>
          </template>

          <div class="add-block-panel">
            <span class="add-label">Додати блок:</span>
            <div class="add-block-buttons">
              <button @click="store.addBlock('paragraph')">¶ Абзац</button>
              <button @click="store.addBlock('heading')">H Заголовок</button>
              <button @click="store.addBlock('list')">≡ Список</button>
              <button @click="store.addBlock('code')">{ } Код</button>
              <button @click="store.addBlock('image')">🖼 Рисунок</button>
              <button @click="store.addBlock('table')">⊞ Таблиця</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <button class="btn-export" @click="handleExport">⬇ Завантажити .docx</button>
      </div>
    </aside>

    <!-- RIGHT: docx-preview -->
    <main class="preview-panel">
      <div class="preview-scroll">
        <div v-if="previewLoading" class="preview-loading">Оновлення...</div>
        <div ref="previewContainer" class="docx-preview-root" />
      </div>
    </main>
  </div>
</template>

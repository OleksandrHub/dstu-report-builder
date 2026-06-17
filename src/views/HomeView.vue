<script setup lang="ts">
import { ref, computed } from 'vue'
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

import type { ReportBlock, TitleLineBlock, TitleSpacerBlock } from '../types/document'
import { resolveTitleVars } from '../types/document'

const store = useReportStore()
const { doc, settings, getBlockIndex, formatListItem, pageStyles, paragraphStyles } = useReport()
const { exportToDocx } = useDocxExport()

type LeftTab = 'titlepage' | 'titleblocks' | 'intro' | 'blocks' | 'settings'
const leftTab = ref<LeftTab>('titlepage')

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

    <!-- RIGHT: A4 Preview — page per page -->
    <main class="preview-panel">
      <div class="preview-scroll">
        <template v-if="doc">

          <!-- PAGE 1: Title page -->
          <div class="a4-page" :style="pageStyles">
            <div class="preview-title-page">
              <template v-for="block in doc.titleTemplate" :key="block.id">
                <div
                  v-if="block.type === 'titleSpacer'"
                  class="preview-title-spacer"
                  :style="{ flex: (block as TitleSpacerBlock).flex }"
                />
                <p
                  v-else
                  :class="[
                    'preview-title-line',
                    `preview-${(block as TitleLineBlock).align}`,
                    { 'preview-bold': (block as TitleLineBlock).bold }
                  ]"
                >{{ resolveTitleVars((block as TitleLineBlock).text, doc.titlePage) }}</p>
              </template>
            </div>
          </div>

          <!-- PAGE 2+: Intro + body -->
          <div class="a4-page" :style="pageStyles">
            <!-- Intro -->
            <div class="preview-intro">
              <p><strong>Тема:</strong> {{ doc.intro.topic }}.</p>
              <p><strong>Мета:</strong> {{ doc.intro.goal }}.</p>
              <p>Варіант №{{ doc.intro.variant }}</p>
              <p><strong>Виконання роботи:</strong></p>
            </div>

            <!-- Body blocks preview -->
            <div
              v-for="block in doc.blocks"
              :key="block.id"
              class="preview-block"
            >
              <!-- Paragraph -->
              <p v-if="block.type === 'paragraph'" class="preview-paragraph" :style="paragraphStyles">
                {{ block.text }}
              </p>

              <!-- Heading -->
              <component
                v-else-if="block.type === 'heading'"
                :is="'h' + block.level"
                class="preview-heading"
              >{{ block.text }}</component>

              <!-- List -->
              <div v-else-if="block.type === 'list'">
                <p v-if="block.introText" class="preview-paragraph" :style="paragraphStyles">
                  {{ block.introText }}
                </p>
                <ol v-if="block.ordered" class="preview-list">
                  <li v-for="(item, idx) in block.items" :key="item.id">
                    {{ formatListItem(item.text, true, idx === block.items.length - 1) }}
                  </li>
                </ol>
                <ul v-else class="preview-list preview-list-bullet">
                  <li v-for="(item, idx) in block.items" :key="item.id">
                    {{ formatListItem(item.text, false, idx === block.items.length - 1) }}
                  </li>
                </ul>
              </div>

              <!-- Code -->
              <div v-else-if="block.type === 'code'">
                <p v-if="block.referenceText" class="preview-paragraph" :style="paragraphStyles">
                  {{ block.referenceText }} {{ doc.settings.listingPrefix.toLowerCase() }} {{ getBlockIndex(block.id, 'code') }}.
                </p>
                <p class="preview-caption preview-caption-top">
                  {{ doc.settings.listingPrefix }} {{ getBlockIndex(block.id, 'code') }} – {{ block.caption }}
                </p>
                <pre class="preview-code">{{ block.code }}</pre>
              </div>

              <!-- Image -->
              <div v-else-if="block.type === 'image'">
                <p v-if="block.referenceText" class="preview-paragraph" :style="paragraphStyles">
                  {{ block.referenceText }} {{ doc.settings.imagePrefix.toLowerCase() }} {{ getBlockIndex(block.id, 'image') }}.
                </p>
                <div class="preview-image-wrap">
                  <img v-if="block.src" :src="block.src" class="preview-image" :alt="block.caption" />
                  <div v-else class="preview-image-placeholder">[Зображення не завантажено]</div>
                </div>
                <p class="preview-caption preview-caption-bottom preview-center">
                  {{ doc.settings.imagePrefix }} {{ getBlockIndex(block.id, 'image') }} – {{ block.caption }}
                </p>
              </div>

              <!-- Table -->
              <div v-else-if="block.type === 'table'">
                <p v-if="block.referenceText" class="preview-paragraph" :style="paragraphStyles">
                  У {{ doc.settings.tablePrefix.toLowerCase() }} {{ getBlockIndex(block.id, 'table') }} {{ block.referenceText }}.
                </p>
                <p class="preview-caption preview-caption-top">
                  {{ doc.settings.tablePrefix }} {{ getBlockIndex(block.id, 'table') }} – {{ block.caption }}
                </p>
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th v-for="(h, i) in block.headers" :key="i">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in block.rows" :key="row.id">
                      <td v-for="(cell, i) in row.cells" :key="i">{{ cell.text }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </template>
      </div>
    </main>
  </div>
</template>

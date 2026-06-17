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
import IntroEditor from '../components/editor/IntroEditor.vue'
import SettingsEditor from '../components/editor/SettingsEditor.vue'

import type { ReportBlock } from '../types/document'

const store = useReportStore()
const { doc, settings, getBlockIndex, formatListItem, pageStyles, paragraphStyles } = useReport()
const { exportToDocx } = useDocxExport()

type LeftTab = 'titlepage' | 'intro' | 'blocks' | 'settings'
const leftTab = ref<LeftTab>('titlepage')

async function handleExport() {
  if (!doc.value) return
  await exportToDocx(doc.value)
}

function onUpdateBlock(id: string, data: Partial<ReportBlock>) {
  store.updateBlock(id, data)
}

const blockCounters = computed(() => {
  const c = { image: 0, code: 0, table: 0 }
  if (!doc.value) return c
  for (const b of doc.value.blocks) {
    if (b.type === 'image') c.image++
    else if (b.type === 'code') c.code++
    else if (b.type === 'table') c.table++
  }
  return c
})

// pt to px for preview
function ptToPx(pt: number) {
  return pt * (96 / 72)
}

const previewFontSize = computed(() =>
  settings.value ? `${ptToPx(settings.value.fontSize)}px` : '18.67px'
)
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
          <button :class="['tab', { active: leftTab === 'titlepage' }]" @click="leftTab = 'titlepage'">Титулка</button>
          <button :class="['tab', { active: leftTab === 'intro' }]" @click="leftTab = 'intro'">Вступ</button>
          <button :class="['tab', { active: leftTab === 'blocks' }]" @click="leftTab = 'blocks'">Блоки</button>
          <button :class="['tab', { active: leftTab === 'settings' }]" @click="leftTab = 'settings'">Стиль</button>
        </div>
      </div>

      <div class="panel-body">
        <TitlePageEditor v-if="leftTab === 'titlepage'" />
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

    <!-- RIGHT: A4 Preview -->
    <main class="preview-panel">
      <div class="preview-scroll">
        <div v-if="doc" class="a4-page" :style="pageStyles">
          <!-- Title page preview -->
          <div class="preview-title-page">
            <p class="preview-center">{{ doc.titlePage.ministry }}</p>
            <p class="preview-center">{{ doc.titlePage.university }}</p>
            <p class="preview-center">{{ doc.titlePage.department }}</p>
            <div class="preview-spacer" />
            <p class="preview-center preview-bold preview-large">ЗВІТ</p>
            <p class="preview-center">про виконання {{ doc.titlePage.workType }} №{{ doc.titlePage.workNumber }}</p>
            <p class="preview-center">на тему: «{{ doc.titlePage.topic }}»</p>
            <p class="preview-center">з дисципліни «{{ doc.titlePage.discipline }}»</p>
            <div class="preview-spacer" />
            <p class="preview-right">Виконав: Студент групи {{ doc.titlePage.studentGroup }}</p>
            <p class="preview-right">{{ doc.titlePage.studentName }}</p>
            <p class="preview-right">Прийняв: {{ doc.titlePage.teacherTitle }}</p>
            <p class="preview-right">{{ doc.titlePage.teacherName }}</p>
            <div class="preview-spacer" />
            <p class="preview-center">{{ doc.titlePage.city }} – {{ doc.titlePage.year }}</p>
          </div>

          <div class="preview-page-break" />

          <!-- Intro preview -->
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
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
export interface TableColumn<T = any> {
  key: string
  label?: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  hideLabel?: boolean
}

interface Props {
  data: any[]
  columns: TableColumn[]
  rowKey?: string
  sortBy?: string
  sortDesc?: boolean
  hideHeader?: boolean
  hoverable?: boolean
  selectedKey?: any
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  columns: () => [],
  rowKey: 'id',
  sortBy: '',
  sortDesc: false,
  hideHeader: false,
  hoverable: true,
})

const emit = defineEmits<{
  'row-click': [item: any]
  'row-dblclick': [item: any]
  'row-keydown': [event: KeyboardEvent, item: any]
  'update:sortBy': [key: string]
  'update:sortDesc': [desc: boolean]
}>()

function handleSort(col: TableColumn) {
  if (!col.sortable) return
  if (props.sortBy === col.key) {
    emit('update:sortDesc', !props.sortDesc)
  } else {
    emit('update:sortBy', col.key)
    // By default, when switching columns, let caller handle default sort direction, 
    // but here we just emit false (asc). Caller can override.
    emit('update:sortDesc', false)
  }
}
</script>

<template>
  <div class="base-table-wrapper">
    <table class="base-table" :class="{ 'is-hoverable': hoverable }">
      <colgroup>
        <col v-for="col in columns" :key="`col-${col.key}`" :style="{ width: col.width }" />
      </colgroup>
      <thead v-if="!hideHeader">
        <tr>
          <th 
            v-for="col in columns" 
            :key="`th-${col.key}`" 
            :class="{ 
              sortable: col.sortable, 
              'is-sorted': sortBy === col.key,
              [`align-${col.align || 'left'}`]: true 
            }"
            @click="handleSort(col)"
          >
            <slot :name="`header-${col.key}`" :column="col">
              <div class="th-content">
                <i
                  v-if="col.sortable"
                  class="sort-arrow fa-solid fa-caret-up"
                  :class="{ active: sortBy === col.key, desc: sortBy === col.key && sortDesc }"
                  aria-hidden="true"
                />
                <span v-if="!col.hideLabel">{{ col.label }}</span>
              </div>
            </slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="(item, index) in data" 
          :key="rowKey && item[rowKey] ? item[rowKey] : index"
          class="base-table-row"
          :class="{ 'is-selected': selectedKey === item[rowKey] }"
          @click="emit('row-click', item)"
          @dblclick="emit('row-dblclick', item)"
          @keydown="emit('row-keydown', $event, item)"
          :tabindex="hoverable || $attrs.onRowClick ? 0 : -1"
        >
          <td 
            v-for="col in columns" 
            :key="`td-${col.key}`"
            :class="[`align-${col.align || 'left'}`]"
          >
            <div class="td-content">
              <slot :name="`cell-${col.key}`" :item="item" :index="index" :value="item[col.key]">
                {{ item[col.key] }}
              </slot>
            </div>
          </td>
        </tr>
        <tr v-if="!data.length" class="empty-row">
          <td :colspan="columns.length">
            <slot name="empty">
              <span class="muted">Không có dữ liệu</span>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.base-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.base-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.base-table th,
.base-table td {
  padding: 0.55rem 0.82rem;
  text-align: left;
}

.base-table th {
  color: var(--color-text-primary);
  font-weight: 500;
  background: var(--color-bg-elevated, var(--color-bg-secondary));
  box-shadow: 0 1px 0 var(--color-border-subtle, var(--color-border-default));
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
}

.base-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.base-table th.sortable:hover {
  background: rgba(255, 255, 255, 0.05);
}

.th-content {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sort-arrow {
  font-size: 0.78rem;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.4));
  opacity: 0.4;
  transition: opacity 0.2s, color 0.2s, transform 0.2s;
  flex-shrink: 0;
}

.sort-arrow.active {
  opacity: 1;
  color: var(--color-text-primary, #ffffff);
}

.sort-arrow.desc {
  transform: rotate(180deg);
}

.base-table-row {
  border-top: 1px solid var(--color-border-default, rgba(255, 255, 255, 0.06));
  background: transparent;
  transition: background 0.15s ease;
}

.base-table tbody tr:last-child {
  border-bottom: 1px solid var(--color-border-default, rgba(255, 255, 255, 0.06));
}

.base-table.is-hoverable .base-table-row:hover {
  background: var(--color-row-hover, rgba(255, 255, 255, 0.04));
  cursor: pointer;
}

.base-table-row.is-selected {
  background: var(--color-row-selected, rgba(59, 130, 246, 0.2)) !important;
  color: var(--color-row-selected-text, #ffffff) !important;
}

.base-table.is-hoverable .base-table-row.is-selected:hover {
  background: var(--color-row-selected-hover, rgba(59, 130, 246, 0.3)) !important;
}

.align-left { text-align: left; }
.align-center { text-align: center; }
.align-right { text-align: right; }

.td-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.align-center .td-content { justify-content: center; }
.align-right .td-content { justify-content: flex-end; }

.empty-row td {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.4));
}
</style>

<script setup lang="ts">
import { BULK_LEVELS } from '@rendi/shared'
import { Check, CloudOff } from 'lucide-vue-next'
import { computed } from 'vue'
import MemberAvatar from '@/components/ui/MemberAvatar.vue'
import { productSubtitle } from '@/features/catalog/format'
import type { ListItem } from './queries'

const props = defineProps<{ item: ListItem }>()
const emit = defineEmits<{ toggle: []; open: [] }>()

/** "Colun · 1 L" o, si es automático, por qué está en la lista. */
const details = computed(() => {
  const { item } = props
  const parts: string[] = []
  const p = item.product
  if (p) {
    parts.push(productSubtitle(p))
  } else if (item.foodId) {
    parts.push('Cualquier marca')
  }
  if (item.note) parts.push(item.note)
  return parts
})

const reason = computed(() => {
  const p = props.item.product
  if (props.item.source !== 'min_stock' || !p) return null
  if (p.stockMode === 'bulk') return p.stock === BULK_LEVELS.empty ? 'Se acabó' : 'Queda poco'
  return p.stock === 0 ? 'Se acabó' : `Quedan ${p.stock} (mín. ${p.minStock})`
})
</script>

<template>
  <li class="item" :class="{ 'item--checked': item.checked }">
    <button
      type="button"
      role="checkbox"
      class="check"
      :aria-checked="item.checked"
      :aria-label="item.name"
      @click="emit('toggle')"
    >
      <span class="box"><Check v-if="item.checked" :size="18" :stroke-width="3" /></span>
    </button>
    <button type="button" class="main" @click="emit('open')">
      <span class="title">
        <span class="name">{{ item.name }}</span>
        <span v-if="item.quantity" class="qty">×{{ item.quantity }}</span>
      </span>
      <span v-if="details.length" class="sub">{{ details.join(' · ') }}</span>
      <span v-if="reason && !item.checked" class="reason">{{ reason }}</span>
      <span v-if="item.checked && item.checkedBy" class="by">
        <MemberAvatar :name="item.checkedBy.name" :emoji="item.checkedBy.avatarEmoji" :size="20" />
        {{ item.checkedBy.name }}
      </span>
    </button>
    <CloudOff
      v-if="item.pending"
      :size="16"
      class="pending"
      role="img"
      aria-label="Sin sincronizar"
    />
  </li>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  padding-right: var(--space-3);
}

.check {
  display: grid;
  flex: none;
  place-items: center;
  width: 56px;
  min-height: 60px;
  border: 0;
  background: transparent;
}

.box {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-accent-contrast);
  transition: background-color 0.12s;
}

.item--checked .box {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.main {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
  min-height: 60px;
  padding: var(--space-2) var(--space-2) var(--space-2) 0;
  border: 0;
  background: transparent;
  text-align: left;
}

.title {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.name {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item--checked .name {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

.qty {
  flex: none;
  color: var(--color-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sub {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reason {
  color: var(--color-warning);
  font-size: 0.8rem;
  font-weight: 600;
}

.by {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.pending {
  flex: none;
  color: var(--color-text-muted);
}
</style>

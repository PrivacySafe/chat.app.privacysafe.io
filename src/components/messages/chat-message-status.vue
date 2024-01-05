<script lang="ts" setup>
  import { computed } from 'vue'
  import { Ui3nIcon } from '@v1nt1248/3nclient-lib'
  import { messageDeliveryStatuses } from '@/constants'

  const props = defineProps<{
    value: MessageDeliveryStatus | undefined;
    iconSize?: number | string;
  }>()

  const iconSize = computed(() => {
    const isSizeNotNumber = isNaN(Number(props.iconSize))
    return isSizeNotNumber ? 16 : Number(props.iconSize)
  })

  const statusUiInfo = computed(() => {
    if (props.value) {
      return messageDeliveryStatuses[props.value] || null
    }
    return null
  })
</script>

<template>
  <ui3n-icon
    v-if="statusUiInfo"
    :icon="statusUiInfo.icon"
    :width="iconSize"
    :height="iconSize"
    :color="statusUiInfo.color"
  />
</template>

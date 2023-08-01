<script lang="ts" setup>
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
  import { getRandomId } from '@/helpers/common.helper'
  import { Icon } from '@iconify/vue'

  type DialogEvent = 'open' | 'opened' | 'before-close' | 'close' | 'closed' | 'confirm' | 'cancel' | 'click-overlay'

  const props = defineProps<{
    component: string;
    componentProps: Record<string, any>;
    dialogProps?: PDialogProps;
  }>()

  const emit = defineEmits([
    'open',
    'opened',
    'before-close',
    'close',
    'closed',
    'confirm',
    'cancel',
    'click-overlay',
  ])

  const component = defineAsyncComponent(() => import(`../dialogs/${props.component}.vue`/* @vite-ignore */))
  const dialogProps = computed(() => {
    const {
      title = 'dialog.title.default',
      width = 380,
      wrapperCssClass = '',
      wrapperCssStyle = {},
      cssClass = '',
      cssStyle = {},
      confirmButton = true,
      cancelButton = true,
      confirmButtonText = 'dialog.confirm.button.default',
      cancelButtonText = 'dialog.cancel.button.default',
      confirmButtonColor = 'var(--system-white)',
      cancelButtonColor = 'var(--blue-main)',
      confirmButtonBackground = 'var(--blue-main)',
      cancelButtonBackground = 'var(--system-white)',
      overlay = true,
      solo = false,
      lockScroll = true,
      closeOnClickOverlay = true,
    } = props.dialogProps || {}
    return {
      title,
      width,
      wrapperCssClass: wrapperCssClass ? `p-dialog ${wrapperCssClass}` : 'p-dialog',
      wrapperCssStyle,
      cssClass,
      cssStyle,
      confirmButton,
      cancelButton,
      confirmButtonText,
      cancelButtonText,
      confirmButtonColor,
      cancelButtonColor,
      confirmButtonBackground,
      cancelButtonBackground,
      overlay,
      solo,
      lockScroll,
      closeOnClickOverlay,
    }
  })

  const show = ref(true)
  const data = ref(null)
  const isValid = ref(true)
  const dialogId = `dialog-${getRandomId(4)}`
  const dialogConfirmButtonElement = ref<Element|null>(null)

  onMounted(() => {
    const dialogElement = document.getElementById(dialogId)
    if (dialogElement) {
      dialogElement.style.setProperty('--dialog-confirm-button-color', dialogProps.value.confirmButtonColor)
      dialogElement.style.setProperty('--dialog-cancel-button-color', dialogProps.value.cancelButtonColor)
      dialogElement.style.setProperty('--dialog-confirm-background-color', dialogProps.value.confirmButtonBackground)
      dialogElement.style.setProperty('--dialog-cancel-background-color', dialogProps.value.cancelButtonBackground)

      dialogConfirmButtonElement.value = dialogElement.querySelector('.var-dialog__confirm-button')
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectData = (value: any) => {
    data.value = value
    if (
      !dialogProps.value.confirmButton
      && !dialogProps.value.cancelButton
      && props.dialogProps?.onConfirm
    ) {
      props.dialogProps.onConfirm(data.value)
      closeDialog()
    }
  }

  const validate = (value: boolean) => {
    isValid.value = value
    if (dialogConfirmButtonElement.value) {
      if (value) {
        dialogConfirmButtonElement.value!.classList.remove('dialog-button__disabled')
      } else {
        dialogConfirmButtonElement.value!.classList.add('dialog-button__disabled')
      }
    }
  }

  const closeDialog = () => {
    show.value = false
    if (dialogProps.value.solo) {
      emit('closed')
    }
  }

  const startEmit = (event: DialogEvent) => {
    if (event === 'confirm' && props.dialogProps?.onConfirm) {
      props.dialogProps.onConfirm(data.value)
      closeDialog()
    }

    if (event === 'cancel' && props.dialogProps?.onCancel) {
      props.dialogProps.onCancel(data.value)
      closeDialog()
    }

    if (data.value) {
      emit(event, data.value)
    } else {
      emit(event)
    }
  }
</script>

<template>
  <!-- eslint-disable vue/no-multiple-template-root  -->
  <var-dialog
    v-if="!dialogProps.solo"
    :id="dialogId"
    v-model:show="show"
    :class="dialogProps.wrapperCssClass"
    :style="dialogProps.wrapperCssStyle"
    :title="dialogProps.title"
    :width="dialogProps.width"
    :dialog-class="dialogProps.cssClass"
    :dialog-style="dialogProps.cssStyle"
    :confirm-button="dialogProps.confirmButton"
    :cancel-button="dialogProps.cancelButton"
    :confirm-button-text="$tr(dialogProps.confirmButtonText)"
    :cancel-button-text="$tr(dialogProps.cancelButtonText)"
    :overlay="dialogProps.overlay"
    :lock-scroll="dialogProps.lockScroll"
    :close-on-click-overlay="dialogProps.closeOnClickOverlay"
    teleport="#main"
    @closed="startEmit('closed')"
    @confirm="startEmit('confirm')"
    @cancel="startEmit('cancel')"
  >
    <template #title>
      <div class="p-dialog__title">
        {{ $tr(dialogProps.title) }}
        <var-button
          round
          size="mini"
          @click="closeDialog"
        >
          <icon
            icon="baseline-close"
            width="16"
            height="16"
            color="#828282"
          />
        </var-button>
      </div>
    </template>

    <component
      :is="component"
      v-if="component"
      v-bind="props.componentProps"
      @select="selectData"
      @validate="validate"
      @close="closeDialog"
    />
  </var-dialog>

  <teleport
    v-if="dialogProps.solo && show"
    to="#main"
  >
    <div
      class="p-dialog__wrap"
      @click.prevent.self="closeDialog"
    >
      <component
        :is="component"
        v-if="component"
        v-bind="props.componentProps"
        @select="selectData"
        @validate="validate"
        @close="closeDialog"
        @confirm="startEmit('confirm')"
        @cancel="startEmit('cancel')"
      />
    </div>
  </teleport>
</template>

<style lang="scss">
  @import "../../assets/styles/mixins";

  .var-dialog__popup {
    border-radius: var(--dialog-border-radius);
  }

  .p-dialog__wrap {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .p-dialog {
    --p-dialog-padding: calc(var(--base-size) * 2);
    --button-round-padding: 2px;

    .var-dialog__title {
      padding: var(--p-dialog-padding);
      border-bottom: 1px solid var(--gray-50);

      .var-button {
        @include reset-button-back;
      }
    }

    .var-dialog__message {
      padding: var(--p-dialog-padding);
    }

    .var-dialog__actions {
      --button-normal-height: calc(var(--base-size) * 4);

      padding: var(--p-dialog-padding);
      flex-direction: row-reverse;
      justify-content: center;

      .var-dialog__confirm-button {
        background-color: var(--dialog-confirm-background-color);
        margin: 0 var(--half-size);

        &.dialog-button__disabled {
          pointer-events: none;
          cursor: default;
          background-color: var(--button-disabled-color);
        }
      }

      .var-dialog__cancel-button {
        background-color: var(--dialog-cancel-background-color);
        margin: 0 var(--half-size);
      }
    }

    &__title {
      position: relative;
      display: flex;
      width: 100%;
      justify-content: space-between;
      align-items: center;
      font-size: var(--font-13);
      font-weight: 600;
      line-height: var(--font-16);
      color: var(--black-90);
      padding-right: calc(var(--base-size) * 2);

      .var-button {
        position: absolute;
        right: -8px;
        top: calc(50% - 10px);
      }
    }
  }
</style>

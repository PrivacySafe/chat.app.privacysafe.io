<script lang="ts" setup>
  import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs } from 'vue'
  import { get, size } from 'lodash'
  import prLogo from '@/assets/images/privacysafe-logo.png'
  import { makeServiceCaller } from '@/libs/ipc-service-caller'
  import { appDeliverySrvProxy } from '@/services/services-provider'
  import { useAppStore, useContactsStore, useChatsStore } from '@/store'
  import { getAppConfig } from '@/helpers/app.helper'
  import { getDeliveryErrors } from '@/helpers/common.helper'
  import ContactIcon from '@/components/contacts/contact-icon.vue'

  const isMenuOpen = ref(false)
  const appElement = ref<Element|null>(null)

  const { user: me, connectivityStatus } = toRefs(useAppStore())
  const {
    setAppWindowSize,
    setColorTheme,
    setConnectivityStatus,
    setLang,
    setUser,
  } = useAppStore()
  const { fetchContactList } = useContactsStore()
  const { currentChatId, chatList } = toRefs(useChatsStore())
  const { getChatList, receiveMessage, handleUpdateMessageStatus } = useChatsStore()


  const connectivityStatusText = computed(() => connectivityStatus.value === 'online'
    ? 'app.status.connected.online'
    : 'app.status.connected.offline'
  )
  const connectivityTimerId = ref<ReturnType<typeof setInterval>|undefined>()

  const appExit = async () => { await w3n.closeSelf!() }

  const getConnectivityStatus = async () => {
    const status = await w3n.connectivity!.isOnline()
    if (status) {
      setConnectivityStatus(status)
    }
  }

  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { contentRect, target } = entry
      const { className } = target
      const { width, height } = contentRect
      if (className === 'app') {
        setAppWindowSize({ width, height })
      }
    }
  })

  onBeforeMount(async () => {
    try {
      await fetchContactList()
      const currentUser = await w3n.mailerid!.getUserId()
      setUser(currentUser)

      await getAppConfig()
      await getConnectivityStatus()
      connectivityTimerId.value = setInterval(getConnectivityStatus, 60000)

      const configSrvConnection = await w3n.rpc!.otherAppsRPC!('launcher.app.privacysafe.io', 'AppConfigs')
      const configSrv = makeServiceCaller<AppConfigs>(configSrvConnection, [], ['watchConfig']) as AppConfigs
      await getChatList()

      configSrv.watchConfig({
        next: ({ lang, currentTheme, colors }) => {
          setLang(lang)
          setColorTheme({ theme: currentTheme, colors })
        },
        error: e => console.error(e),
        complete: () => configSrvConnection.close(),
      })

      const deliverySrvConnection = await w3n.rpc!.thisApp!('ChatDeliveryService')
      const deliverSrv = makeServiceCaller(deliverySrvConnection, [], [
        'watchIncomingMessages', 'watchOutgoingMessages',
      ]) as AppDeliveryService

      deliverSrv.watchIncomingMessages({
        next: msg => {
          const { jsonBody, msgId } = msg
          const { chatMessageType, chatId, members = [] } = jsonBody

          const membersFromDb = get(chatList.value, [chatId, 'members'])
          const realMembers = membersFromDb || members
          if (
            chatMessageType === 'system'
            || (chatMessageType === 'regular' && realMembers.includes(currentUser))
          ) {
            receiveMessage({
              me: currentUser,
              msg,
              currentChatId: currentChatId.value,
            })
          } else {
            appDeliverySrvProxy.removeMessageFromInbox([msgId])
          }
        },
        error: e => console.error(e),
        complete: () => deliverySrvConnection.close(),
      })

      deliverSrv.watchOutgoingMessages({
        next: val => {
          const { id, progress } = val
          const { allDone, recipients } = progress
          if (allDone) {
            appDeliverySrvProxy.removeMessageFromDeliveryList([id])
            const errors = getDeliveryErrors(progress)
            const { localMeta = {} } = progress
            const { path } = localMeta

            if (!path.includes('system')) {
              // TODO it's necessary to change when we will add new delivery status (not only 'sent' or 'error')
              const status = size(errors) === 0 || (size(recipients) > size(errors))
                ? 'sent'
                : 'error'

              handleUpdateMessageStatus({ msgId: id, value: status })
            }
          }
        },
        error: e => console.error(e),
        complete: () => deliverySrvConnection.close(),
      })

      await appDeliverySrvProxy.start()
    } catch (e) {
      console.error('\nERR-MOUNTED: ', e)
      throw e
    }
  })

  onMounted(() => {
    if (appElement.value) {
      const { width, height } = appElement.value?.getBoundingClientRect()
      setAppWindowSize({ width, height })
      resizeObserver.observe(appElement.value as Element)
    }
  })

  onBeforeUnmount(() => {
    connectivityTimerId.value && clearInterval(connectivityTimerId.value!)
  })
</script>

<template>
  <div
    ref="appElement"
    class="app"
  >
    <div class="app__toolbar">
      <div class="app__toolbar-title">
        <img
          :src="prLogo"
          alt="logo"
          class="app__toolbar-logo"
        >
        <div class="app__toolbar-delimiter">
          /
        </div>
        <div class="app__toolbar-app">
          {{ $tr('app.title') }}
        </div>
      </div>

      <div class="app__toolbar-user">
        <div class="app__toolbar-user-info">
          <span class="app__toolbar-user-mail">
            {{ me }}
          </span>
          <span class="app__toolbar-user-connection">
            {{ $tr('app.status') }}:
            <span :class="{'app__toolbar-user-connectivity': connectivityStatusText === 'app.status.connected.online'}">
              {{ $tr(connectivityStatusText) }}
            </span>
          </span>
        </div>
        <var-menu
          v-model:show="isMenuOpen"
          :offset-y="40"
          :offset-x="-40"
        >
          <div
            class="app__toolbar-icon"
            @click="isMenuOpen = true"
          >
            <contact-icon
              :name="me"
              :size="36"
              :readonly="true"
            />
          </div>

          <template #menu>
            <div class="app__toolbar-menu">
              <var-cell
                class="app__toolbar-menu-item"
                @click="appExit"
              >
                {{ $tr('app.exit') }}
              </var-cell>
            </div>
          </template>
        </var-menu>
      </div>
    </div>
    <div class="app__content">
      <router-view v-slot="{ Component }">
        <transition>
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <div id="notification" />
  </div>
</template>

<style lang="scss" scoped>
  .app {
    --main-toolbar-height: calc(var(--base-size) * 9);

    position: fixed;
    inset: 0;

    &__toolbar {
      position: relative;
      width: 100%;
      height: var(--main-toolbar-height);
      padding: 0 calc(var(--base-size) * 2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--gray-50, #f2f2f2);

      &-title {
        display: flex;
        justify-content: flex-start;
        align-items: center;
      }

      &-logo {
        position: relative;
        top: -2px;
        margin-right: calc(var(--base-size) * 2);
      }

      &-delimiter {
        font-size: 20px;
        font-weight: 500;
        color: var(--blue-main, #0090ec);
        margin-right: calc(var(--base-size) * 2);
        padding-bottom: 2px;
      }

      &-app {
        font-size: var(--font-20);
        font-weight: 500;
        color: var(--black-90, #212121);
        padding-bottom: 3px;
      }

      &-user {
        display: flex;
        justify-content: flex-end;
        align-items: center;

        &-info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
          margin-right: calc(var(--base-size) * 2);

          span:not(.app__toolbar-user-connectivity) {
            color: var(--black-90, #212121);
            line-height: 1.4;
          }
        }

        &-mail {
          font-size: var(--font-14);
          font-weight: 600;
        }

        &-connection {
          font-size: var(--font-12);
          font-weight: 500;
        }

        &-connectivity {
          color: var(--green-grass-100, #33c653);
        }
      }

      &-icon {
        position: relative;
        cursor: pointer;
      }

      &-menu {
        position: relative;
        background-color: var(--system-white, #fff);
        width: 80px;

        &-item {
          cursor: pointer;
        }
      }
    }

    &__content {
      position: fixed;
      inset: calc(var(--main-toolbar-height) + 1px) 0 0 0;
      bottom: 0;
    }

    #notification {
      position: fixed;
      bottom: calc(var(--base-size) / 2);
      left: calc(var(--base-size) * 2);
      right: calc(var(--base-size) * 2);
      z-index: 5000;
      height: auto;
      display: flex;
      justify-content: center;
      align-content: flex-end;
    }
  }
</style>

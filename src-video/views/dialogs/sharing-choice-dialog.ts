/*
Copyright (C) 2025 3NSoft Inc.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see <http://www.gnu.org/licenses/>.
*/

import { DIALOGS_KEY, DialogsPlugin, I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { useStreamsStore } from '@video/store/streams';
import { EmitFn, defineAsyncComponent, inject, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { ScreenShareOption, SharedStream, WindowShareOption } from '@video/components/types';
import { Deferred, defer } from '@v1nt1248/3nclient-lib/utils';

export function screenSharingChoiceDialogMaker() {

  const component = defineAsyncComponent(
    () => import('./screen-share-choice-dialog.vue')
  );
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;
  const streams = useStreamsStore();

  function absorbSelectedChoices(
    data: { selected: SharedStream[]; selectedDeskSound: boolean; }|null
  ) {
    if (!data) {
      return;
    }
    const { selected, selectedDeskSound } = data;
    // unshare those not among selected
    streams.ownScreens
    ?.filter(({ srcId }) => !selected.find(s => (s.srcId === srcId)))
    .forEach(({ srcId }) => streams.removeOwnScreen(srcId));
    // add selected if not already shared
    for (const { srcId, stream, type, name } of selected) {
      if (!streams.ownScreens?.find(s => (s.srcId === srcId))) {
        streams.addOwnScreen(stream, type, srcId, name);
      }
    }
    streams.setOwnDeskSoundSharing(
      streams.ownScreens ? selectedDeskSound : false
    );
  }

  return () => dialog.$openDialog({
    component,
    componentProps: {
      intiallyShared: (streams.ownScreens ? streams.ownScreens.concat() : []),
      initialDeskSoundShared: streams.ownDeskSound
    },
    dialogProps: {
      title: $tr("sharing.choice.title"),
      onConfirm: absorbSelectedChoices as any
    },
  });;
}

export interface ScreenShareChoicesProps {
  intiallyShared: SharedStream[];
  initialDeskSoundShared: boolean;
}

export type ScreenShareChoicesEmits = EmitFn<[ 'select' ]>;

export function useScreenShareChoiceDialog(
  props: ScreenShareChoicesProps,
  emits: ScreenShareChoicesEmits
) {

  const { intiallyShared } = props;
  function isAlreadyShared(srcId: string): boolean {
    return !!intiallyShared.find(s => (s.srcId === srcId))
  }

  type DisplaySourceInfo = web3n.media.DisplaySourceInfo;

  const screenChoices = ref<ScreenShareOption[]>();
  const windowChoices = ref<WindowShareOption[]>();

  const deferredStreams = new Map<string, Deferred<MediaStream>>();
  function makeDeferredStream(srcId: string): Promise<MediaStream> {
      const deferredStream = defer<MediaStream>();
    deferredStreams.set(srcId, deferredStream);
      return deferredStream.promise;
  }

  async function collectAvailableScreenShareOptions(): Promise<void> {
    await w3n.mediaDevices!.setSelectDisplayMediaForCaptureHandler!(
      displayChoicesCollectionCB
    );

    mediaIdToGet = undefined;
    await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    .catch(err => console.error(`Error on the start of collection`, err));

    async function setStreamIn(
      { srcId, initiallySelected }: ScreenShareOption|WindowShareOption
    ): Promise<void> {
      if (initiallySelected) {
        const { stream } = intiallyShared.find(s => (s.srcId === srcId))!;
        deferredStreams.get(srcId)?.resolve(stream);
      } else {
        mediaIdToGet = srcId;
        const deferred = deferredStreams.get(mediaIdToGet);
        if (deferred) {
          deferredStreams.delete(mediaIdToGet);
          await navigator.mediaDevices.getDisplayMedia({
            video: true, audio: true
          }).then(
            stream => {
              deferred.resolve(stream);
            },
            err => deferred.reject(err)
          );
        }
        mediaIdToGet = undefined;
      }
    }

    if (screenChoices.value) {
      for (const screen of screenChoices.value) {
        await setStreamIn(screen);
      }
    }

    if (windowChoices.value) {
      for (const frame of windowChoices.value) {
        await setStreamIn(frame);
      }
    }
  }

  let mediaIdToGet: string|undefined = undefined;

  async function displayChoicesCollectionCB(
    choices: DisplaySourceInfo
  ): Promise<string|undefined> {
    if (mediaIdToGet === undefined) {
      screenChoices.value = choices.screens?.map(info => {
        const { id: srcId, name, display_id } = info;
        const thumbnailURL = toImgURL(info.thumbnail)!;
        return {
          srcId, name, display_id, thumbnailURL,
          initiallySelected: isAlreadyShared(srcId),
          stream: makeDeferredStream(srcId)
        };
      });
      windowChoices.value = choices.windows?.map(info => {
        const { id: srcId, name } = info;
        const thumbnailURL = toImgURL(info.thumbnail)!;
        const appIconURL = toImgURL(info.appIcon);
        return {
          srcId, name, thumbnailURL, appIconURL,
          initiallySelected: isAlreadyShared(srcId),
          stream: makeDeferredStream(srcId)
        };
      });
      return;
    } else {
      return mediaIdToGet;
    }
  }

  function toImgURL(arr: Uint8Array|undefined): string|undefined {
    if (!arr) {
      return;
    }
    const blob = new Blob([ arr ], { type: 'image/bmp' });
    return URL.createObjectURL(blob);
  }

  let selectedDeskSound = props.initialDeskSoundShared;

  function onDeskSoundChange(v: boolean): void {
    selectedDeskSound = v;
    emits('select', { selected, selectedDeskSound });
  }

  const selected: SharedStream[] = intiallyShared.concat();

  async function onOptionSelectionChange(
    opt: ScreenShareOption|WindowShareOption, v: boolean
  ): Promise<void> {
    if (v) {
      const stream = await opt.stream;
      selected.push({
        srcId: opt.srcId,
        stream,
        type: ((opt as ScreenShareOption).display_id ? 'screen' : 'window'),
        name: opt.name
      });
    } else {
      const streamId = (await opt.stream).id;
      const ind = selected.findIndex(({ stream: { id } }) => (id === streamId));
      selected.splice(ind, 1);
    }
    emits('select', { selected, selectedDeskSound });
  }

  onBeforeMount(() => {
    collectAvailableScreenShareOptions();
  });

  onBeforeUnmount(() => {
    w3n.mediaDevices!.setSelectDisplayMediaForCaptureHandler!(
      async () => undefined
    );
  });

  return {
    screenChoices,
    windowChoices,
    onOptionSelectionChange,
    onDeskSoundChange
  };
}
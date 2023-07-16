import { SingleProc } from './base/processes'
import { randomStr } from "./base/random";



export async function outgoingFileLinkStore(): Promise<FileLinkStoreService> {
  const fileProc = new SingleProc()
  let fs:web3n.files.WritableFS | undefined

  const initializing = async (): Promise<void> => {
    fs = await w3n.storage?.getAppLocalFS()
  }

  const checkFs = async (): Promise<void> => {
    if (!fs) {
      await initializing()
    }
  }

  const saveLink = async (file: web3n.files.ReadonlyFile): Promise<string> => {
    const fileId = randomStr(20)

    try {
      await checkFs()
      await fileProc.startOrChain(() => fs!.link(fileId, file))
    } catch (e) {
      console.error(`Error saving link to ${file.name}. `, e)
    }

    return fileId
  }

  const getLink = async (fileId: string): Promise<web3n.files.SymLink|null|undefined> => {
    try {
      await checkFs()
      return await fileProc.startOrChain(() => fs!.readLink(fileId))
    } catch (e) {
      console.error(`Error getting link ${fileId}. `, e)
      const { notFound, path } = e as web3n.files.FileException
      if (path === fileId && notFound) {
        return null
      }
    }
  }

  const getFile = async (fileId: string): Promise<web3n.files.Linkable|null|undefined> => {
    try {
      const link = await getLink(fileId)
      if (link && link.isFile) {
        return await link.target()
      }
      return null
    } catch (e) {
      console.error(`Error getting file ${fileId}. `, e)
    }
  }

  const deleteLink = async (fileId: string): Promise<void> => {
    try {
      await checkFs()
      await fileProc.startOrChain(() => fs!.deleteLink(fileId))
    } catch (e) {
      console.error(`Error deleting link ${fileId}. `, e)
    }
  }

  await initializing()

  return {
    saveLink,
    getLink,
    getFile,
    deleteLink,
  }
}

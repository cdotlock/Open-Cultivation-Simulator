import { FC, useCallback } from "react";
import { useRecoilState } from "recoil";
import { toastState } from "../store";
import { useCopyToClipboard } from 'usehooks-ts'
import { $img } from "@/utils";
import { useToast } from "../hooks/useToast";
import { useCharacterCrud } from "../hooks/charCrud";

const ToastProvider: FC<{ children: React.ReactNode }> = (props) => {
  const [toastText] = useRecoilState(toastState)
  const { showToast } = useToast()
  const { shareCharacterInfo, copyLink, shortUrl, closeShare } = useCharacterCrud()
  const copy = useCopyToClipboard()[1]

  const handleCopyLink = useCallback(() => {
    copy(copyLink)
    showToast('链接已复制到剪贴板')
  }, [copy, showToast, copyLink])

  const handleCopyId = useCallback(() => {
    copy(`${shortUrl}`)
    showToast('密钥已复制到剪贴板')
  }, [copy, showToast, shortUrl])

  const eventStopPropagation = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }, [])

  return (
    <div>
      {props.children}
      {
        toastText && 
        <div className="fixed top-1/2 z-40 text-center left-1/2 -translate-1/2 p-[4px_16px] bg-white rounded-[20px] text-[#111] font-family-song">
          {toastText}
        </div>
      }
      {
        shareCharacterInfo.type === 'share' && <div className="fixed inset-0 z-30 flex flex-col items-center justify-center">
          <div onClick={closeShare} className="absolute inset-0 bg-[#000000B2] backdrop-blur-[5px]"></div>
          <div onClick={eventStopPropagation} className="relative w-[311px] h-[280px] leading-[1]">
            <img className="w-full h-full" src={$img('bg-invite')} alt="bg-invite" />
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-[20px]">
              <div className="text-[#111] text-[24px]">链接已复制到剪贴板</div>
              <div className="text-[#11111188] text-[12px]">（防止心仪角色走丢，快粘贴到备忘录）</div>
              <div style={{ backgroundImage: `url(${$img('share-item-bg')})` }}
                className="w-[251px] h-[40px] mt-[12px] flex items-center gap-[6px] bg-cover bg-center px-[8px]">
                <div className="text-[#111] text-[14px] line-clamp-1 text-ellipsis break-keep">{copyLink}</div>
                <img onClick={handleCopyLink} className="w-[20px] h-[20px] shrink-0 ml-auto" src={$img('icon-copy')} alt="icon-copy" />
              </div>
              <div className="text-[#111111] mt-[16px] text-[16px]">你也可以保存角色密钥</div>
              <div className="text-[#11111188] text-[12px]">（留存备用，也可通过分享链接再次唤醒角色）</div>
              <div style={{ backgroundImage: `url(${$img('share-item-bg')})` }}
                className="w-[251px] h-[40px] mt-[12px] flex items-center gap-[6px] bg-cover bg-center px-[8px]">
                <div className="text-[#111] text-[14px] line-clamp-1 text-ellipsis">{shortUrl}</div>
                <img onClick={handleCopyId} className="w-[20px] h-[20px] shrink-0 ml-auto" src={$img('icon-copy')} alt="icon-copy" />
              </div>
            </div>
          </div>
          <img onClick={closeShare} className="relative w-[32px] h-[32px] mt-[16px]" src={$img('icon-cancel')} alt="icon-cancel" />
        </div>
      }
    </div>
  )
}

export default ToastProvider
